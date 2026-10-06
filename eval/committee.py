"""The committee run: eval/committee.json through Rafiq on the production models, judged on the
committee's criteria, with the tokens and cost of every question.

    cd ai && uv run python ../eval/committee.py              # the whole set
    cd ai && uv run python ../eval/committee.py --only official-03:ar talk-post:en
    cd ai && uv run python ../eval/committee.py --run 2      # the set again, for agreement
    cd ai && uv run python ../eval/committee.py --baseline   # official cases, model alone

Rafiq runs in this process through the same `load_rafiq` the service's /ask uses, so every call
to OpenRouter can be counted. Rule checks come from eval/run.py; the judge (JUDGE_MODEL) grades the
committee's criteria (eval/committee-judge.md) and the case's judged checks. Results go to
eval/results/; docs/EVALUATION.md is written by hand from them.
"""

import argparse
import asyncio
import datetime as dt
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Literal

import httpx
from pydantic import BaseModel

EVAL = Path(__file__).resolve().parent
sys.path.insert(0, str(EVAL))
sys.path.insert(0, str(EVAL.parent / "ai"))

import run as reliability  # noqa: E402

from app.config import AI_ROOT, Settings  # noqa: E402
from app.llm import ModelUnavailableError, OpenRouterChat  # noqa: E402
from app.main import load_rafiq  # noqa: E402
from app.rafiq.graph import Rafiq  # noqa: E402
from app.rafiq.name import without_name  # noqa: E402
from app.rafiq.schemas import Turn, RafiqAnswer, SharedPost  # noqa: E402

RESULTS = EVAL / "results"
STEM = "2026-10-05-committee"
# The models ai/.env names, as production runs them; filled in main().
PRODUCTION: dict[str, str] = {}
MODEL_FIELDS = ("llm_model", "llm_fallback_model", "embedding_model", "vlm_model", "vlm_fallback_model")
JUDGE_MODEL = "openai/gpt-6-luna"
CRITERIA = (
    "onTopic",
    "expectedBehaviour",
    "explains",
    "companion",
    "noClaimInTalk",
    "noTarjih",
    "noConsensus",
    "glossaryForm",
    "supported",
)
EXTRA_JUDGED = {
    "reassuresFirst": (
        "The first thing read is reassurance; general information and the specialist card follow; "
        "no warning comes first."
    ),
}
# The plain prompt of the baseline: the same model, no sources, no rules.
BASELINE_PROMPT = (
    "You are a helpful assistant. Answer the user's question about Islam clearly and accurately."
)
REFUSALS = {"verseNotFound", "hadithNotFound", "noSource", "noEvidence"}


def everyday_talk(answer: RafiqAnswer, _: object) -> bool:
    """A chat reply: no source, no refusal, no referral other than the quiet everyday one."""
    reason = answer.referral.reason if answer.referral else None
    return answer.kind == "chat" and not answer.sources and reason in (None, "smalltalk")


def language_matches(answer: RafiqAnswer, expected: object) -> bool:
    return answer.language == expected


RULES = {
    **reliability.RULES,
    "everydayTalk": everyday_talk,
    "notFoundAsQuoted": lambda a, _: bool(a.referral) and a.referral.reason in REFUSALS,  # type: ignore[union-attr]
    "answerLanguage": language_matches,
}
JUDGED = {**reliability.JUDGED, **EXTRA_JUDGED}


class Verdict(BaseModel):
    verdict: Literal["pass", "fail", "na"] = "fail"
    reason: str = ""


class Graded(BaseModel):
    passed: bool = False
    reason: str = ""


class Judgement(BaseModel):
    criteria: dict[str, Verdict] = {}
    checks: dict[str, Graded] = {}


class Usage:
    """Every OpenRouter call made through one HTTP client: model, tokens, and cost."""

    def __init__(self, prices: dict[str, dict[str, float]]) -> None:
        self.prices = prices
        self.calls: list[dict[str, Any]] = []

    async def hook(self, response: httpx.Response) -> None:
        if "openrouter.ai" not in response.request.url.host or response.status_code != 200:
            return
        await response.aread()
        try:
            data = response.json()
        except ValueError:
            return
        usage = data.get("usage") or {}
        model = data.get("model") or json.loads(response.request.content or b"{}").get("model")
        price = self.prices.get(str(model), {})
        prompt, completion = usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)
        self.calls.append(
            {
                "kind": "embeddings" if "embeddings" in response.request.url.path else "chat",
                "model": model,
                "promptTokens": prompt,
                "completionTokens": completion,
                "cost": prompt * price.get("prompt", 0.0)
                + completion * price.get("completion", 0.0),
            }
        )

    def since(self, start: int) -> dict[str, Any]:
        calls = self.calls[start:]
        return {
            "calls": len(calls),
            "promptTokens": sum(c["promptTokens"] for c in calls),
            "completionTokens": sum(c["completionTokens"] for c in calls),
            "cost": round(sum(c["cost"] for c in calls), 6),
            "byModel": {
                model: sum(1 for c in calls if c["model"] == model)
                for model in dict.fromkeys(c["model"] for c in calls)
            },
        }


async def openrouter_prices(client: httpx.AsyncClient) -> dict[str, dict[str, float]]:
    prices: dict[str, dict[str, float]] = {}
    for path in ("models", "embeddings/models"):
        response = await client.get(f"https://openrouter.ai/api/v1/{path}")
        response.raise_for_status()
        for model in response.json()["data"]:
            pricing = model.get("pricing") or {}
            prices[model["id"]] = {
                "prompt": float(pricing.get("prompt") or 0),
                "completion": float(pricing.get("completion") or 0),
            }
    return prices


def load_set(name: str = "committee.json") -> list[dict[str, Any]]:
    data = json.loads((EVAL / name).read_text(encoding="utf-8"))
    cases: list[dict[str, Any]] = []
    for include in data["include"]:
        listed = json.loads((EVAL / include["file"]).read_text(encoding="utf-8"))["cases"]
        for case in listed:
            if "ids" not in include or case["id"] in include["ids"]:
                cases.append({**case, "set": include["set"]})
    return cases + data["cases"]


def page_messages(language: str) -> dict[str, Any]:
    """The words the page shows around a reply in this language: the page's own for Arabic and
    English; for Urdu, Bengali and French their reviewed lines, over the English ones."""
    web = EVAL.parent / "web" / "messages"
    page = "ar" if language == "ar" else "en"
    messages: dict[str, Any] = json.loads((web / f"{page}.json").read_text("utf-8"))["Rafiq"]
    own = json.loads((web / "answer-languages.json").read_text("utf-8")).get(language)
    if own:
        messages = {
            **messages,
            **{key: value for key, value in own.items() if key != "referral"},
            "referral": {**messages["referral"], **own.get("referral", {})},
        }
    return messages


def shown(answer: RafiqAnswer) -> str:
    """The reply as a guest with no name reads it: the warm lines, the blocks with what the page
    prints around them, the sources, any card, all in the answer's language."""
    messages = page_messages(answer.language)
    # A chat reply whose own line did not pass its checks shows the page's fixed line.
    fixed = messages["smalltalk"] if answer.kind == "chat" else None
    lines = [answer.opening or fixed] if answer.opening or fixed else []
    for block in answer.blocks:
        if block.type == "text":
            label = "Generated explanation" if block.role == "explanation" else "Generated answer"
            lines.append(f"({label}) {block.text}")
        elif block.type == "quran":
            name = f"{block.surah_name} {block.ayah}" if block.surah_name else block.ref
            translation = (
                f"\n  {block.translation} ({block.translation_name}, {block.translation_version})"
                if block.translation
                else ""
            )
            lines.append(f"[Quoted verse, {name} [{block.n}]: {block.arabic}{translation}]")
        elif block.type == "hadith":
            text = f"\n  {block.text}" if block.text else ""
            explanation = (
                f"\n  HadeethEnc's explanation: {block.explanation}" if block.explanation else ""
            )
            grade = block.grade or messages["gradeNotStated"]
            lines.append(
                f"[Quoted hadith #{block.id} [{block.n}]: {block.arabic}{text}\n"
                f"  Grade: {grade}. Attribution: {block.attribution}{explanation}]"
            )
        elif block.type == "term":
            lines.append(
                f"[Approved English equivalent [{block.n}]: {block.term} → {block.approved}]"
            )
            lines.append(f"[Quoted usage rule from the glossary [{block.n}]: {block.rule}]")
            if block.definition:
                lines.append(f"[Quoted definition [{block.definition_n}]: {block.definition}]")
        elif block.type == "book":
            lines.append(
                f"[Quoted from the book «{block.title}» ({block.reference}), in {block.language} "
                f"[{block.n}]: {block.text}]"
            )
        else:
            lines.append(f"({messages[block.note]})")
    lines += [line for line in (answer.encouragement, answer.follow_up) if line]
    for source in answer.sources:
        lines.append(f"Source [{source.n}]: {source.title} — {source.reference} — {source.url}")
    if answer.referral and answer.referral.reason != "smalltalk":
        card = messages["referral"][answer.referral.reason]
        lines.append(f"Referral card (fixed page text): {card['title']} {card['body']}")
    if answer.language_fallback:
        lines.append("(Notice: the answer is in English because that language is not supported.)")
    # The page fills in the learner's name, or removes the placeholder when there is none.
    return without_name("\n".join(lines))


async def judge(
    chat: OpenRouterChat, case: dict[str, Any], question: str, seen: str
) -> tuple[dict[str, Verdict], dict[str, reliability.CheckResult]]:
    names = [name for name in case["checks"] if name in JUDGED]
    checks = "\n".join(f"- {name}: {JUDGED[name]}" for name in names) or "(none)"
    user = (
        f"Question:\n{question}\n\nExpected behaviour:\n{case['expected']}\n\n"
        f"Reply as shown:\n{seen}\n\nThe case's checks:\n{checks}\n\n"
        f"Committee criteria to grade: {', '.join(CRITERIA)}"
    )
    system = (EVAL / "committee-judge.md").read_text(encoding="utf-8")
    try:
        result = await chat.json(system, user, Judgement)
        if any(c not in result.criteria for c in CRITERIA):
            # One more try when the judge left criteria out; a gap is then marked "not graded".
            result = await chat.json(system, user, Judgement)
    except ModelUnavailableError:
        unavailable = Verdict(verdict="fail", reason="judge unavailable")
        return {c: unavailable for c in CRITERIA}, {
            n: reliability.CheckResult(passed=False, graded="judge", reason="judge unavailable")
            for n in names
        }
    criteria = {c: result.criteria.get(c, Verdict(reason="not graded")) for c in CRITERIA}
    graded = {
        name: reliability.CheckResult(
            passed=result.checks[name].passed if name in result.checks else False,
            graded="judge",
            reason=result.checks[name].reason if name in result.checks else "not graded",
        )
        for name in names
    }
    return criteria, graded


def expected_for(value: object, language: str) -> object:
    return value.get(language) if isinstance(value, dict) else value


async def run_item(
    rafiq: Rafiq,
    usage: Usage,
    judge_chat: OpenRouterChat,
    judge_usage: Usage,
    case: dict[str, Any],
    language: str,
) -> dict[str, Any]:
    question = case["question"][language]
    locale = language if language in ("ar", "en") else "en"
    shared = case.get("shared", {}).get(locale)
    calls, mcp_before = len(usage.calls), rafiq.retriever._mcp.calls
    started = time.perf_counter()
    try:
        # Earlier turns of a conversation the case is asked in, if it has them.
        history = [Turn(**turn) for turn in case.get("history", {}).get(language, [])]
        answer: RafiqAnswer | None = await rafiq.run(
            question, locale, shared=SharedPost(**shared) if shared else None, history=history
        )
        error = None
    except Exception as failure:
        answer, error = None, type(failure).__name__
    seconds = round(time.perf_counter() - started, 1)
    item: dict[str, Any] = {
        "id": case["id"],
        "set": case["set"],
        "language": language,
        "question": question,
        "seconds": seconds,
        "usage": usage.since(calls),
        "mcpCalls": rafiq.retriever._mcp.calls - mcp_before,
    }
    if answer is None:
        return {**item, "passed": False, "error": error, "checks": {}, "criteria": {}}
    checks = {
        name: reliability.CheckResult(
            passed=RULES[name](answer, expected_for(expected, language)), graded="rule"
        )
        for name, expected in case["checks"].items()
        if name in RULES
    }
    seen = shown(answer)
    judged_from = len(judge_usage.calls)
    criteria, graded = await judge(judge_chat, case, question, seen)
    checks |= graded
    passed = all(c.passed for c in checks.values()) and len(checks) == len(case["checks"])
    passed = passed and all(v.verdict != "fail" for v in criteria.values())
    return {
        **item,
        "passed": passed,
        "outcome": reliability.outcome(
            reliability.Item(
                id=case["id"],
                category=case["set"],
                language="en",
                question=question,
                critical=False,
                passed=passed,
                checks=checks,
                ms=0,
                answer=answer,
            )
        ),
        "checks": {name: check.model_dump() for name, check in checks.items()},
        "criteria": {name: verdict.model_dump() for name, verdict in criteria.items()},
        "judgeUsage": judge_usage.since(judged_from),
        "shown": seen,
        "answer": answer.model_dump(mode="json", by_alias=True),
    }


async def baseline_item(
    client: httpx.AsyncClient,
    key: str,
    usage: Usage,
    judge_chat: OpenRouterChat,
    case: dict[str, Any],
    language: str,
) -> dict[str, Any]:
    """The same question to the same model with a plain prompt: no sources, no checks."""
    question = case["question"][language]
    calls = len(usage.calls)
    started = time.perf_counter()
    response = await client.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {key}"},
        json={
            "model": PRODUCTION["llm_model"],
            "messages": [
                {"role": "system", "content": BASELINE_PROMPT},
                {"role": "user", "content": question},
            ],
        },
        timeout=120,
    )
    response.raise_for_status()
    text = response.json()["choices"][0]["message"]["content"]
    seconds = round(time.perf_counter() - started, 1)
    judged_case = {**case, "checks": {n: v for n, v in case["checks"].items() if n in JUDGED}}
    criteria, graded = await judge(judge_chat, judged_case, question, text)
    return {
        "id": case["id"],
        "language": language,
        "question": question,
        "seconds": seconds,
        "usage": usage.since(calls),
        "reply": text,
        "checks": {name: check.model_dump() for name, check in graded.items()},
        "criteria": {name: verdict.model_dump() for name, verdict in criteria.items()},
        "passed": all(c.passed for c in graded.values())
        and all(v.verdict != "fail" for v in criteria.values()),
    }


def merge(path: Path, rerun: list[dict[str, Any]]) -> list[dict[str, Any]]:
    fresh = {(item["id"], item["language"]): item for item in rerun}
    earlier = json.loads(path.read_text(encoding="utf-8"))["items"]
    for item in earlier:
        key = (item["id"], item["language"])
        if key in fresh:
            history = [
                *item.get("earlier", []),
                {k: item[k] for k in ("passed", "criteria", "checks") if k in item},
            ]
            fresh[key]["earlier"] = history
    return [fresh.pop((i["id"], i["language"]), i) for i in earlier] + list(fresh.values())


def summary(items: list[dict[str, Any]]) -> dict[str, Any]:
    by_set: dict[str, dict[str, int]] = {}
    for item in items:
        tally = by_set.setdefault(item.get("set", "official"), {"passed": 0, "total": 0})
        tally["total"] += 1
        tally["passed"] += bool(item["passed"])
    failing: dict[str, int] = {}
    for item in items:
        for name, verdict in item.get("criteria", {}).items():
            failing[name] = failing.get(name, 0) + (verdict["verdict"] == "fail")
    times = sorted(item["seconds"] for item in items)
    return {
        "items": len(items),
        "passed": sum(bool(i["passed"]) for i in items),
        "bySet": by_set,
        "criterionFailures": failing,
        "medianSeconds": times[len(times) // 2] if times else 0,
        "rafiqCost": round(sum(i["usage"]["cost"] for i in items), 6),
        "rafiqTokens": {
            "prompt": sum(i["usage"]["promptTokens"] for i in items),
            "completion": sum(i["usage"]["completionTokens"] for i in items),
        },
    }


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--only", nargs="*", help="id:language items to rerun into the results")
    parser.add_argument("--run", type=int, default=1, help="2 writes a second, separate run")
    parser.add_argument("--baseline", action="store_true", help="official cases, model alone")
    parser.add_argument("--set", default="committee.json", help="the set file under eval/")
    parser.add_argument("--stem", default=STEM, help="the results file's name")
    args = parser.parse_args()

    settings = Settings(_env_file=AI_ROOT / ".env")  # type: ignore[call-arg]
    PRODUCTION.update({f: str(getattr(settings, f)) for f in MODEL_FIELDS if getattr(settings, f)})
    judge_model = os.environ.get("JUDGE_MODEL") or JUDGE_MODEL
    judge_settings = settings.model_copy(
        update={"llm_model": judge_model, "llm_fallback_model": None}
    )
    wanted = {tuple(entry.split(":", 1)) for entry in args.only or []}
    cases = load_set(args.set)
    if args.baseline:
        cases = [case for case in cases if case["set"] == "official"]

    async with httpx.AsyncClient(timeout=60) as plain:
        prices = await openrouter_prices(plain)
    usage, judge_usage = Usage(prices), Usage(prices)
    items: list[dict[str, Any]] = []
    async with (
        httpx.AsyncClient(timeout=180, event_hooks={"response": [usage.hook]}) as client,
        httpx.AsyncClient(timeout=180, event_hooks={"response": [judge_usage.hook]}) as judging,
    ):
        judge_chat = OpenRouterChat(judge_settings, judging)
        rafiq = None if args.baseline else load_rafiq(settings, client)
        if not args.baseline and rafiq is None:
            sys.exit("Rafiq could not be built: check OPENROUTER_API_KEY in ai/.env")
        key = settings.openrouter_api_key.get_secret_value() if settings.openrouter_api_key else ""
        for case in cases:
            for language in case["question"]:
                if wanted and (case["id"], language) not in wanted:
                    continue
                if args.baseline:
                    item = await baseline_item(client, key, usage, judge_chat, case, language)
                else:
                    item = await run_item(rafiq, usage, judge_chat, judge_usage, case, language)
                items.append(item)
                print(
                    f"{item['id']:20} {language} {'pass' if item['passed'] else 'FAIL'} "
                    f"{item['seconds']:5.1f}s ${item['usage']['cost']:.5f}",
                    flush=True,
                )

    RESULTS.mkdir(exist_ok=True)
    name = "baseline" if args.baseline else ("" if args.run == 1 else f"run{args.run}")
    path = RESULTS / f"{args.stem}{'-' + name if name else ''}.json"
    if wanted and path.exists():
        items = merge(path, items)
    path.write_text(
        json.dumps(
            {
                "ranOn": dt.datetime.now(dt.UTC).strftime("%Y-%m-%d %H:%M UTC"),
                "how": "in-process, through load_rafiq (the code the service's /ask runs)",
                "models": {**PRODUCTION, "judge": judge_model},
                "prices": {m: prices.get(m) for m in {*PRODUCTION.values(), judge_model}},
                "summary": summary(items),
                # Successful calls per model: the fallback should answer few or none.
                "answeredBy": dict(getattr(rafiq.chat, "answered", {})) if rafiq else {},
                "judgeCost": round(sum(c["cost"] for c in judge_usage.calls), 6),
                "items": items,
            },
            ensure_ascii=False,
            indent=1,
        )
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary(items), indent=1))
    print(f"Results: {path.relative_to(EVAL.parent)}")


if __name__ == "__main__":
    asyncio.run(main())
