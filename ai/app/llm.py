"""Models through OpenRouter's OpenAI-compatible API: chat with a fallback, and embeddings.

Model names come only from settings. Free variants may not honour JSON mode or tool calling, so
every structured answer is requested as JSON, validated with Pydantic, retried once with the
validation error, and then asked of the fallback model. A 429 or a server error moves straight to
the fallback.
"""

import asyncio
import json
import logging
import re
import time
from typing import Protocol

import httpx
import numpy as np
from pydantic import BaseModel, ValidationError

from app.config import Settings

API = "https://openrouter.ai/api/v1"
# Free variants share pools upstream that answer 429 in bursts. A model that just did is skipped
# for COOLDOWN seconds; only when every model is rate-limited does the client wait for a new round.
COOLDOWN = 60.0
ROUND_WAITS = (4.0, 10.0)
log = logging.getLogger("rafiq.llm")


class ModelUnavailableError(Exception):
    """No configured model returned a valid answer."""


class ChatModel(Protocol):
    async def json[T: BaseModel](self, system: str, user: str, schema: type[T]) -> T: ...


class Embedder(Protocol):
    async def embed(self, texts: list[str]) -> np.ndarray: ...


def extract_json(content: str) -> object:
    """The first JSON object in a reply, with or without code fences or thinking around it."""
    content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", content, flags=re.DOTALL)
    if fenced:
        return json.loads(fenced.group(1))
    start = content.find("{")
    if start < 0:
        raise ValueError("no JSON object in the reply")
    depth, in_string, escaped = 0, False, False
    for index in range(start, len(content)):
        char = content[index]
        if in_string:
            escaped = char == "\\" and not escaped
            if char == '"' and not escaped:
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return json.loads(content[start : index + 1])
    raise ValueError("unterminated JSON object in the reply")


class OpenRouterChat:
    def __init__(self, settings: Settings, client: httpx.AsyncClient) -> None:
        if settings.openrouter_api_key is None or settings.llm_model is None:
            raise ModelUnavailableError("OPENROUTER_API_KEY and LLM_MODEL are required")
        self._key = settings.openrouter_api_key.get_secret_value()
        self._models = [m for m in (settings.llm_model, settings.llm_fallback_model) if m]
        self._data_collection = settings.openrouter_data_collection
        self._client = client
        self._cooling_until: dict[str, float] = {}

    async def _complete(self, model: str, messages: list[dict[str, str]], strict: bool) -> str:
        body: dict[str, object] = {
            "model": model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 2500,
            "provider": {"data_collection": self._data_collection},
        }
        if strict:
            # JSON mode, and no hidden reasoning (it would spend the budget and slow the answer).
            body["response_format"] = {"type": "json_object"}
            body["reasoning"] = {"enabled": False}
        response = await self._client.post(
            f"{API}/chat/completions",
            headers={"Authorization": f"Bearer {self._key}"},
            json=body,
            timeout=90,
        )
        if response.status_code == 400 and strict:
            # Some free providers reject these options; the prompt still asks for JSON.
            return await self._complete(model, messages, strict=False)
        response.raise_for_status()
        return self._content(response)

    @staticmethod
    def _content(response: httpx.Response) -> str:
        choices = response.json().get("choices") or []
        content = choices[0].get("message", {}).get("content") if choices else None
        if not content:
            raise ValueError("empty reply")
        return str(content)

    def _ordered(self) -> list[str]:
        """Models in preference order, those cooling down after a 429 last."""
        now = time.monotonic()
        return sorted(self._models, key=lambda model: self._cooling_until.get(model, 0.0) > now)

    async def json[T: BaseModel](self, system: str, user: str, schema: type[T]) -> T:
        for wait in (*ROUND_WAITS, None):
            rate_limited = 0
            for model in self._ordered():
                messages = [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ]
                for attempt in range(2):
                    try:
                        content = await self._complete(model, messages, strict=True)
                    except httpx.HTTPStatusError as error:
                        status = error.response.status_code
                        log.warning("model %s answered %s", model, status)
                        if status == 429:
                            rate_limited += 1
                            self._cooling_until[model] = time.monotonic() + COOLDOWN
                        break
                    except (httpx.TransportError, ValueError) as error:
                        log.warning("model %s failed: %s", model, type(error).__name__)
                        break
                    try:
                        return schema.model_validate(extract_json(content))
                    except (ValueError, ValidationError) as error:
                        log.warning(
                            "model %s returned invalid JSON (attempt %d)", model, attempt + 1
                        )
                        messages = [
                            *messages,
                            {"role": "assistant", "content": content},
                            {
                                "role": "user",
                                "content": "That was not valid. Reply with the JSON object only. "
                                f"Problem: {str(error)[:300]}",
                            },
                        ]
            if rate_limited < len(self._models) or wait is None:
                break
            await asyncio.sleep(wait)
        raise ModelUnavailableError("no model returned a valid answer")


class OpenRouterEmbedder:
    def __init__(self, settings: Settings, client: httpx.AsyncClient, batch: int = 64) -> None:
        if settings.openrouter_api_key is None or settings.embedding_model is None:
            raise ModelUnavailableError("OPENROUTER_API_KEY and EMBEDDING_MODEL are required")
        self._key = settings.openrouter_api_key.get_secret_value()
        self._model = settings.embedding_model
        self._client = client
        self._batch = batch

    async def embed(self, texts: list[str]) -> np.ndarray:
        """Unit-length vectors, one row per text."""
        rows: list[list[float]] = []
        for start in range(0, len(texts), self._batch):
            response = await self._client.post(
                f"{API}/embeddings",
                headers={"Authorization": f"Bearer {self._key}"},
                json={"model": self._model, "input": texts[start : start + self._batch]},
                timeout=120,
            )
            response.raise_for_status()
            data = sorted(response.json()["data"], key=lambda item: item["index"])
            rows.extend(item["embedding"] for item in data)
        vectors = np.asarray(rows, dtype=np.float32)
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        return vectors / np.where(norms == 0, 1, norms)
