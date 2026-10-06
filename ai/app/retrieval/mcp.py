"""The official MCP server of the Association for Multilingual Islamic Content, read live.

Through langchain-mcp-adapters over streamable HTTP: one request at a time (the server answers
429 to bursts), an 8-second timeout, a back-off on 429, and an in-memory cache. When the server is
down Rafiq carries on with local sources: every call returns None instead of raising.
"""

import asyncio
import json
import logging
import time
from collections import OrderedDict
from typing import Protocol

import httpx
from langchain_mcp_adapters.client import MultiServerMCPClient
from mcp.types import TextContent

log = logging.getLogger("rafiq.mcp")

SERVER = "islamic-content"
TIMEOUT = 8.0
GAP = 1.0
CACHE_SIZE = 256


class ToolCaller(Protocol):
    calls: int

    async def call(self, tool: str, arguments: dict[str, object]) -> str | None: ...


def _is_rate_limited(error: BaseException) -> bool:
    if isinstance(error, httpx.HTTPStatusError):
        return error.response.status_code == 429
    if isinstance(error, BaseExceptionGroup):
        return any(_is_rate_limited(inner) for inner in error.exceptions)
    return "429" in str(error)


class McpClient:
    def __init__(self, url: str) -> None:
        self._client = MultiServerMCPClient({SERVER: {"url": url, "transport": "streamable_http"}})
        self._gate = asyncio.Semaphore(1)
        self._last = 0.0
        self._cache: OrderedDict[str, str] = OrderedDict()
        self.calls = 0

    async def call(self, tool: str, arguments: dict[str, object]) -> str | None:
        """The tool's text result, or None when it errs or the server cannot be reached."""
        key = f"{tool}:{json.dumps(arguments, sort_keys=True, ensure_ascii=False)}"
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]
        async with self._gate:
            for attempt in range(3):
                await asyncio.sleep(max(0.0, self._last + GAP - time.monotonic()))
                self._last = time.monotonic()
                self.calls += 1
                try:
                    async with asyncio.timeout(TIMEOUT), self._client.session(SERVER) as session:
                        result = await session.call_tool(tool, arguments)
                except Exception as error:
                    if _is_rate_limited(error) and attempt < 2:
                        await asyncio.sleep(2.0 * 2**attempt)
                        continue
                    log.warning("mcp %s unavailable (%s)", tool, type(error).__name__)
                    return None
                if result.isError:
                    log.warning("mcp %s returned an error", tool)
                    return None
                text = "\n".join(
                    block.text for block in result.content if isinstance(block, TextContent)
                )
                self._cache[key] = text
                if len(self._cache) > CACHE_SIZE:
                    self._cache.popitem(last=False)
                return text
        return None
