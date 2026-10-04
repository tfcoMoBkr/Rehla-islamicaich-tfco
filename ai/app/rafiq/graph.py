"""Rafiq's pipeline as a LangGraph graph: classify → retrieve → generate → verify → respond, with
a `refer` exit, and exits that need no sources: small talk and feelings (`chat`), an unclear
follow-up (`clarify`), off-topic messages, and signs of danger.

    safety ─┬─ danger (checked in code, before any model)
            └─ classify ─┬─ danger · offtopic · chat · clarify
                         └─ retrieve ─┬─ refer (an extractive language with no passage in it)
                                      └─ generate ─┬─ refer
                                           ▲       └─ verify ─┬─ respond
                                           └─ (one retry) ────┤
                                                              └─ refer (problems left after repair)

verify checks the draft in code (check.py), then asks a model, in one call, whether each cited
sentence is supported and whether a warm line (opening, follow-up) makes a religious statement.
The first time it finds problems in the answer the draft is written again with them listed; the
second time they are repaired in code (repair.py) and checked again, and only what still fails, or
a draft with nothing cited left, is referred. A warm line that fails is dropped, never referred.
"""

import logging
import time
from pathlib import Path
from typing import Literal, TypedDict

from langgraph.graph import END, START, StateGraph

from app.languages import DEFAULT, LANGUAGES, Language, spec
from app.llm import ChatModel
from app.rafiq import policy
from app.rafiq.check import Problem, cited, code_problems, counts
from app.rafiq.compose import compose
from app.rafiq.draft import Unit, parse, render
from app.rafiq.repair import finish, repair
from app.rafiq.safety import danger_signs
from app.rafiq.schemas import (
    ChatReply,
    Classification,
    Draft,
    KeywordQueries,
    PageLocale,
    RafiqAnswer,
    Referral,
    ReferralReason,
    ReplyKind,
    SupportCheck,
    Turn,
)
from app.rafiq.specialists import SPECIALIST_PAGE, referral_centres
from app.rafiq.warmth import screened
from app.retrieval.passages import Passage
from app.retrieval.retriever import Retrieval, Retriever

log = logging.getLogger("rafiq")
PROMPTS = Path(__file__).parent / "prompts"
MAX_ATTEMPTS = 2
HelpMode = Literal["simpler", "example", "question"]


def prompt(name: str, **values: str) -> str:
    text = (PROMPTS / f"{name}.md").read_text(encoding="utf-8")
    for key, value in values.items():
        text = text.replace(f"{{{key}}}", value)
    return text


def answer_language(classification: Classification) -> tuple[Language, bool]:
    """The language to answer in, and whether it differs from the question's (unsupported)."""
    if classification.language in LANGUAGES:
        return classification.language, False  # type: ignore[return-value]
    return DEFAULT, True


def referral(reason: ReferralReason) -> Referral:
    """A referral names the specialist page and, when it calls for them, the bodies to show."""
    if reason in policy.SPECIALIST_REASONS:
        return Referral(reason=reason, links=[SPECIALIST_PAGE], centers=referral_centres())
    links = [] if reason == "smalltalk" else [SPECIALIST_PAGE]
    return Referral(reason=reason, links=links)


class LessonContext(TypedDict):
    lesson_id: str
    line: str
    mode: HelpMode


class State(TypedDict, total=False):
    question: str
    locale: PageLocale
    history: list[Turn]
    scope: list[str] | None
    lesson: LessonContext | None
    danger: bool
    classification: Classification
    language: Language
    language_fallback: bool
    retrieval: Retrieval
    draft: Draft | None
    units: list[Unit]
    warm: dict[str, str]
    problems: list[Problem]
    attempts: int
    answer: RafiqAnswer


def _passages_text(passages: list[Passage]) -> str:
    lines = []
    for passage in passages:
        if passage.verse:
            ref = passage.verse.ref
            label = f"quran {ref}; show it with {{{{quran:{ref}}}}}"
        elif passage.hadith:
            hadith = passage.hadith
            show = f"{{{{hadith:{hadith.id}}}}}"
            label = f"hadith {hadith.id}, grade: {hadith.grade}; show it with {show}"
        else:
            label = f"{passage.type}: {passage.title} — {passage.reference}"
        lines.append(f"[{passage.n}] ({label}, in {passage.lang})\n{passage.text[:1500]}")
    return "\n\n".join(lines)


LESSON_TASKS = {
    "simpler": "explain this line more simply",
    "example": "give one short example of what this line means, using only the passages",
    "question": "answer the learner's question about this line",
}


def _required_verse(state: State) -> str | None:
    misquote = state["retrieval"].misquote
    return misquote.ref if misquote and not misquote.exact else None


def _mode_rules(state: State) -> str:
    """The rules (prompts/rules/) this question calls for, on top of the general prompt."""
    classification = state["classification"]
    rules = [prompt(f"shapes/{classification.question_type}")]
    if not spec(state["language"]).local:
        rules.append(prompt("rules/extractive", language_name=spec(state["language"]).name))
    mode = policy.mode(classification)
    if mode != "full":
        rules.append(prompt(f"rules/{mode}"))
    if classification.hostile_tone:
        rules.append(prompt("rules/hostile"))
    if classification.asks_for_evidence:
        rules.append(prompt("rules/evidence"))
    misquote = state["retrieval"].misquote
    if misquote and not misquote.exact:
        rules.append(prompt("rules/misquote", quoted=misquote.quoted, ref=misquote.ref))
    lesson = state.get("lesson")
    if lesson:
        rules.append(prompt("rules/lesson", line=lesson["line"], task=LESSON_TASKS[lesson["mode"]]))
    return "".join(rules)


def _history(state: State) -> str:
    turns = state.get("history") or []
    if not turns:
        return ""
    return (
        "Earlier in the conversation:\n"
        + "\n".join(f"{turn.role}: {turn.text}" for turn in turns)
        + "\n\n"
    )


def _earlier_replies(state: State) -> str | None:
    replies = [turn.text for turn in state.get("history") or [] if turn.role == "assistant"]
    return "\n".join(replies) if replies else None


def _question(state: State) -> str:
    """The question as retrieval and generation see it: rewritten to stand alone when it was a
    follow-up."""
    classification = state.get("classification")
    standalone = classification.standalone if classification else None
    return standalone.strip() if standalone and standalone.strip() else state["question"]


def _speaks(state: State) -> bool:
    """Rafiq writes warm lines himself only in the languages he answers in full; for the others
    the page shows fixed lines from its (reviewed) message file."""
    return spec(state["language"]).local


class Rafiq:
    def __init__(self, chat: ChatModel, retriever: Retriever, *, debug: bool = False) -> None:
        self._chat = chat
        self._retriever = retriever
        # RAFIQ_DEBUG: logs drafts and problem texts. Local diagnosis only, never in production.
        self._debug = debug
        self._graph = self._build()

    async def _keywords(self, question: str, language: Language) -> list[str]:
        try:
            result = await self._chat.json(
                prompt("keywords", language_name=spec(language).name), question, KeywordQueries
            )
        except Exception:
            return []
        return [query.strip() for query in result.queries if query.strip()][:2]

    @staticmethod
    def _safety(state: State) -> State:
        return {"danger": bool(danger_signs(state["question"]))}

    async def _classify(self, state: State) -> State:
        lesson = state.get("lesson")
        if lesson and lesson["mode"] != "question":
            # Explaining a lesson line: no ruling is asked, the answer is in the page's language.
            classification = Classification(language=state["locale"], level="B", intent="religious")
        else:
            classification = await self._chat.json(
                prompt("classify"), _history(state) + state["question"], Classification
            )
        language, fallback = answer_language(classification)
        if lesson:
            language, fallback = state["locale"], False
        return {
            "classification": classification,
            "language": language,
            "language_fallback": fallback,
            "attempts": 0,
            "problems": [],
            "warm": {},
        }

    async def _retrieve(self, state: State) -> State:
        classification = state["classification"]
        query = _question(state)
        lesson = state.get("lesson")
        if lesson:
            query = f"{query} {lesson['line']}" if lesson["mode"] == "question" else lesson["line"]
        retrieval = await self._retriever.retrieve(
            query,
            state["language"],
            scope=state.get("scope"),
            phrases=classification.search_phrases,
            quoted_verse=classification.quoted_verse,
            keywords=self._keywords,
        )
        return {"retrieval": retrieval}

    async def _generate(self, state: State) -> State:
        passages = state["retrieval"].passages
        attempts = state.get("attempts", 0) + 1
        if not passages:
            return {"draft": None, "attempts": attempts}
        feedback = ""
        if state.get("problems"):
            feedback = "\n\nYour last answer had these problems; fix them:\n" + "\n".join(
                f"- {problem.text}" for problem in state["problems"]
            )
        asked = state["question"]
        rewritten = _question(state)
        question = asked if rewritten == asked else f"{asked}\n(It asks: {rewritten})"
        listed = _passages_text(passages)
        language_name = spec(state["language"]).name
        user = (
            f"{_history(state)}Question: {question}\n\nPassages:\n\n{listed}{feedback}"
            f"\n\nWrite your reply in {language_name}."
        )
        system = prompt("generate", language_name=language_name, mode_rules=_mode_rules(state))
        draft = await self._chat.json(system, user, Draft)
        return {"draft": draft, "attempts": attempts, "problems": []}

    async def _model_check(
        self,
        units: list[Unit] | None,
        passages: list[Passage],
        warm: dict[str, str],
        *,
        ruling_guard: bool = False,
    ) -> tuple[list[Problem], dict[str, str]]:
        """One model call: unsupported cited sentences, and the warm lines that may stay. Under the
        ruling guard a sentence that states a ruling counts as unsupported, whatever it cites."""
        sentences = cited(units) if units else []
        if not sentences and not warm:
            return [], warm
        by_number = {passage.n: passage for passage in passages}
        listing = "\n\n".join(
            f"Sentence {index}: {units[u].sentences[s] if units else ''}\nCited passages:\n"
            + "\n".join(f"[{n}] {by_number[n].text[:1200]}" for n in numbers if n in by_number)
            for index, (u, s, numbers) in enumerate(sentences, start=1)
        )
        listing += "".join(f"\n\nWarm line {field}: {text}" for field, text in warm.items())
        try:
            rule = prompt("rules/verify-general") if ruling_guard else ""
            system = prompt("verify", ruling_rule=rule)
            check = await self._chat.json(system, listing.strip(), SupportCheck)
        except Exception:
            # Unchecked warm lines are not shown; cited sentences keep their code checks.
            log.warning("support check unavailable; code checks only")
            return [], {}
        problems = []
        for index in check.unsupported:
            if 0 < index <= len(sentences) and units:
                u, s, _ = sentences[index - 1]
                text = units[u].sentences[s][:120]
                problems.append(
                    Problem(
                        "unsupported",
                        f"This sentence is not supported by its passages: «{text}»",
                        unit=u,
                        sentence=s,
                    )
                )
        kept = {field: text for field, text in warm.items() if field not in check.religious}
        return problems, kept

    def _warm_lines(self, state: State, draft: Draft | ChatReply) -> dict[str, str]:
        if not _speaks(state):
            return {}
        lines = {"opening": draft.opening, "followUp": draft.follow_up}
        passages = state["retrieval"].passages if "retrieval" in state else []
        return screened(lines, passages, state["language"], _earlier_replies(state))

    async def _verify(self, state: State) -> State:
        draft = state["draft"]
        assert draft is not None
        passages = state["retrieval"].passages
        required = _required_verse(state)
        last_try = state.get("attempts", 0) >= MAX_ATTEMPTS
        units = parse(draft.answer)
        warm = self._warm_lines(state, draft)
        problems = code_problems(units, passages, required, state["language"])
        self._log_problems(state, "code", draft.answer, problems)
        if problems and last_try:
            repaired = repair(units, problems, passages, required, state["language"])
            problems = [] if repaired is not None else problems
            units = repaired if repaired is not None else units
            self._log_problems(state, "repaired", render(units), problems)
        if not problems:
            problems, warm = await self._model_check(
                units,
                passages,
                warm,
                ruling_guard=policy.needs_ruling_guard(state["classification"]),
            )
            self._log_problems(state, "support", render(units), problems)
            if problems and last_try:
                repaired = repair(units, problems, passages, required, state["language"])
                problems = [] if repaired is not None else problems
                units = repaired if repaired is not None else units
        return {"problems": problems, "units": units, "warm": warm}

    def _log_problems(self, state: State, stage: str, text: str, problems: list[Problem]) -> None:
        # Without RAFIQ_DEBUG only categories and counts are logged, never the question or answer.
        log.info(
            "verify attempt=%d stage=%s problems=%s",
            state.get("attempts", 0),
            stage,
            counts(problems),
        )
        if self._debug:
            log.info("verify draft:\n%s\nproblems: %s", text, [p.text for p in problems])

    def _respond(self, state: State) -> State:
        classification = state["classification"]
        reason = policy.referral_after_answer(classification)
        extractive = not spec(state["language"]).local
        units = finish(
            state["units"],
            state["retrieval"].passages,
            required_verse=_required_verse(state),
            extractive=extractive,
        )
        answer = compose(
            units,
            state["retrieval"].passages,
            state["language"],
            classification.level,
            referral(reason) if reason else None,
            explanations=extractive,
        )
        warm = state.get("warm", {})
        kind: ReplyKind = "referral" if reason else "answer"
        answer = answer.model_copy(
            update={"kind": kind, "opening": warm.get("opening"), "follow_up": warm.get("followUp")}
        )
        return {"answer": self._decorated(state, answer)}

    async def _refer(self, state: State) -> State:
        classification = state["classification"]
        reason: ReferralReason
        if state.get("problems"):
            reason = "verification"
        else:
            reason = (
                policy.referral_without_answer(classification, state.get("draft")) or "noSource"
            )
        answer = self._bare(state, reason, "referral")
        draft = state.get("draft")
        if draft is not None:
            # Even a referral opens kindly: the opening the model wrote, if it passes the checks.
            _, warm = await self._model_check(None, [], self._warm_lines(state, draft))
            answer = answer.model_copy(update={"opening": warm.get("opening")})
        return {"answer": self._decorated(state, answer)}

    async def _chat_reply(self, state: State) -> State:
        """Small talk and feelings: a human reply first, and an offer to help where one fits."""
        answer = self._bare(state, "smalltalk", "chat")
        if not _speaks(state):
            return {"answer": self._decorated(state, answer)}
        system = prompt("chat", language_name=spec(state["language"]).name)
        reply = await self._chat.json(system, _history(state) + state["question"], ChatReply)
        _, warm = await self._model_check(None, [], self._warm_lines(state, reply))
        answer = answer.model_copy(
            update={"opening": warm.get("opening"), "follow_up": warm.get("followUp")}
        )
        return {"answer": self._decorated(state, answer)}

    async def _clarify(self, state: State) -> State:
        """An unclear follow-up gets one short question back instead of a guess."""
        answer = self._bare(state, "smalltalk", "clarify")
        question = state["classification"].clarification or ""
        if _speaks(state) and question:
            lines = screened({"clarification": question}, [], state["language"])
            _, warm = await self._model_check(None, [], lines)
            answer = answer.model_copy(update={"opening": warm.get("clarification")})
        return {"answer": self._decorated(state, answer)}

    def _danger(self, state: State) -> State:
        if "language" not in state:
            # Caught before classification: the page's language, which the message is likely in.
            state = {**state, "language": state["locale"]}
        return {"answer": self._decorated(state, self._bare(state, "danger", "danger"))}

    @staticmethod
    def _decorated(state: State, answer: RafiqAnswer) -> RafiqAnswer:
        later = state["retrieval"].later_lesson if "retrieval" in state else None
        return answer.model_copy(
            update={
                "later_lesson_id": later,
                "language_fallback": state.get("language_fallback", False),
            }
        )

    def _bare(self, state: State, reason: ReferralReason, kind: ReplyKind) -> RafiqAnswer:
        classification = state.get("classification")
        quiet = reason in ("smalltalk", "offTopic", "danger") or classification is None
        return RafiqAnswer(
            language=state["language"],
            level=None if quiet or classification is None else classification.level,
            referred=reason != "smalltalk",
            kind=kind,
            blocks=[],
            sources=[],
            referral=referral(reason),
        )

    def _offtopic(self, state: State) -> State:
        return {"answer": self._decorated(state, self._bare(state, "offTopic", "referral"))}

    @staticmethod
    def _after_safety(state: State) -> str:
        return "danger" if state.get("danger") else "classify"

    @staticmethod
    def _after_classify(state: State) -> str:
        return policy.route(state["classification"])

    @staticmethod
    def _after_retrieve(state: State) -> str:
        """A language answered extractively needs at least one passage published in it."""
        language = state["language"]
        if spec(language).local:
            return "generate"
        own = [p for p in state["retrieval"].passages if p.lang == language]
        return "generate" if own else "refer"

    @staticmethod
    def _after_generate(state: State) -> str:
        return (
            "refer"
            if policy.referral_without_answer(state["classification"], state.get("draft"))
            else "verify"
        )

    @staticmethod
    def _after_verify(state: State) -> str:
        if not state.get("problems"):
            return "respond"
        return "generate" if state.get("attempts", 0) < MAX_ATTEMPTS else "refer"

    def _build(self):  # noqa: ANN202 (a compiled LangGraph graph)
        graph = StateGraph(State)
        graph.add_node("safety", self._safety)
        graph.add_node("classify", self._classify)
        graph.add_node("retrieve", self._retrieve)
        graph.add_node("generate", self._generate)
        graph.add_node("verify", self._verify)
        graph.add_node("respond", self._respond)
        graph.add_node("refer", self._refer)
        graph.add_node("chat", self._chat_reply)
        graph.add_node("clarify", self._clarify)
        graph.add_node("offtopic", self._offtopic)
        graph.add_node("danger", self._danger)
        graph.add_edge(START, "safety")
        graph.add_conditional_edges(
            "safety", self._after_safety, {"danger": "danger", "classify": "classify"}
        )
        graph.add_conditional_edges(
            "classify",
            self._after_classify,
            {
                "retrieve": "retrieve",
                "chat": "chat",
                "clarify": "clarify",
                "offtopic": "offtopic",
                "danger": "danger",
            },
        )
        graph.add_conditional_edges(
            "retrieve", self._after_retrieve, {"generate": "generate", "refer": "refer"}
        )
        graph.add_conditional_edges(
            "generate", self._after_generate, {"verify": "verify", "refer": "refer"}
        )
        graph.add_conditional_edges(
            "verify",
            self._after_verify,
            {"respond": "respond", "generate": "generate", "refer": "refer"},
        )
        for end in ("respond", "refer", "chat", "clarify", "offtopic", "danger"):
            graph.add_edge(end, END)
        return graph.compile()

    async def run(
        self,
        question: str,
        locale: PageLocale,
        *,
        history: list[Turn] | None = None,
        scope: list[str] | None = None,
        lesson: LessonContext | None = None,
    ) -> RafiqAnswer:
        started = time.perf_counter()
        state = await self._graph.ainvoke(
            {
                "question": question,
                "locale": locale,
                "history": history or [],
                "scope": scope,
                "lesson": lesson,
            }
        )
        answer: RafiqAnswer = state["answer"]
        retrieval = state.get("retrieval")
        # Logs carry only the outcome, timings and counts: never the question or the answer.
        log.info(
            "answered kind=%s language=%s level=%s referred=%s reason=%s passages=%d mcp_calls=%d "
            "attempts=%d ms=%d",
            answer.kind,
            answer.language,
            answer.level,
            answer.referred,
            answer.referral.reason if answer.referral else None,
            len(retrieval.passages) if retrieval else 0,
            retrieval.mcp_calls if retrieval else 0,
            state.get("attempts", 0),
            (time.perf_counter() - started) * 1000,
        )
        return answer
