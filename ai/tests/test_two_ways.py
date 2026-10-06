"""Rafiq's two ways of talking (everyday talk, religious knowledge), his voice, the shape of a
religious answer and the checks on it, and the behaviour rules for the committee's cases.
Fake models only."""

import asyncio

import pytest
from pydantic import BaseModel

from app.rafiq import graph as graph_module
from app.rafiq.check import code_problems
from app.rafiq.draft import explanation_units, parse
from app.rafiq.graph import Rafiq
from app.rafiq.name import without_name
from app.rafiq.schemas import ChatReply, Classification, Draft, SharedPost, TextBlock, Turn
from app.rafiq.voice import is_stock, name_due, voiced
from app.retrieval import retriever as retriever_module
from app.retrieval.retriever import Retrieval, Retriever

from .fakes import VERSE, WUDU, DownMcp, FakeChat, FakeEmbedder, book, index

QUESTION = "How do I perform wudu?"
SHAPED = Draft(
    relevant=[1, 2],
    answer="You wash your face, arms and feet in a set order [1].",
    show=["{{quran:2:256}}"],
    explanation=[
        "Wudu is the washing you do before prayer [1].",
        "The order matters: hands first, then mouth and face [1].",
    ],
    encouragement="You are learning this one step at a time.",
    followUp="Shall we look at what breaks wudu next?",
)
MOSQUE_POST = SharedPost(
    title="My first visit to a mosque",
    body="I did not know where to leave my shoes. A man showed me the racks. Arrive early.",
)

CONVERSATION = "this message is conversation: it needs no religious knowledge"


@pytest.fixture(autouse=True)
def low_threshold(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(retriever_module, "WEAK_COSINE", 0.2)


def classified(**fields: object) -> Classification:
    base: dict[str, object] = {"language": "en", "level": "A", "intent": "religious"}
    return Classification.model_validate({**base, **fields})


class WideningRetriever(Retriever):
    def __init__(self) -> None:
        super().__init__(index(WUDU, VERSE), FakeEmbedder(), DownMcp())
        self.widened: list[list[str]] = []

    async def widen(self, retrieval: Retrieval, queries: list[str], language: str) -> Retrieval:
        self.widened.append(queries)
        return await super().widen(retrieval, queries, language)  # type: ignore[arg-type]


def rafiq(chat: FakeChat, retriever: Retriever | None = None) -> Rafiq:
    return Rafiq(chat, retriever or Retriever(index(WUDU, VERSE), FakeEmbedder(), DownMcp()))


def passages_asked(chat: FakeChat) -> bool:
    return any("Passages:" in user for user in chat.users)


# Everyday talk.


@pytest.mark.parametrize("intent", ["talk", "smalltalk", "feelings"])
async def test_everyday_talk_needs_no_source_and_is_never_a_referral(intent: str) -> None:
    chat = FakeChat(
        classified(intent=intent, talk=True, talkKind="progress"),
        [SHAPED],
        chat=ChatReply.model_validate(
            {"reply": "Slow is still moving. You came back today.", "next": ""}
        ),
    )
    answer = await rafiq(chat).run("I feel I am learning too slowly.", "en")

    assert answer.kind == "chat"
    assert not answer.referred
    assert answer.sources == []
    assert without_name(answer.opening or "") == "Slow is still moving. You came back today."
    assert not passages_asked(chat)


async def test_an_ordinary_shared_post_is_explained_as_talk_not_sent_to_the_sources() -> None:
    chat = FakeChat(
        classified(intent="talk", talk=True, talkKind="sharedText"),
        [SHAPED],
        chat=ChatReply.model_validate(
            {"reply": "They describe their first visit: where shoes go, and arriving early helped."}
        ),
    )
    answer = await rafiq(chat).run(
        "Can you help me understand this post?", "en", shared=MOSQUE_POST
    )

    assert answer.kind == "chat"
    assert answer.referral is not None
    assert answer.referral.reason == "smalltalk"
    assert "where shoes go" in (answer.opening or "")
    assert not passages_asked(chat)
    talk_prompt = next(system for system in chat.systems if CONVERSATION in system)
    assert talk_prompt.startswith("Rafiq is the learner's friendly companion on the journey.")
    assert "The one hard line: no religious claim of your own." in talk_prompt


async def test_a_mixed_message_answers_the_talk_part_and_the_religious_part_in_one_reply() -> None:
    mixed = Draft.model_validate(
        {
            **SHAPED.model_dump(by_alias=True),
            "talk": "Being nervous before the first time is very common.",
        }
    )
    chat = FakeChat(
        classified(talk=True, talkKind="feelings", religiousPart="How is wudu done?"), [mixed]
    )
    answer = await rafiq(chat).run("I am nervous. How is wudu done?", "en")

    assert answer.kind == "answer"
    assert "very common" in (answer.opening or "")
    assert answer.sources
    generate = next(user for user in chat.users if "Passages:" in user)
    assert "(The part to answer from the passages: How is wudu done?)" in generate


async def test_a_religious_sentence_in_everyday_talk_is_removed_and_the_rest_stays() -> None:
    chat = FakeChat(
        classified(intent="feelings", talk=True),
        [SHAPED],
        chat=ChatReply.model_validate(
            {"reply": "I hear you. Prayer erases every sin. Keep going."}
        ),
        religious=["talk 2"],
    )
    answer = await rafiq(chat).run("Today was hard.", "en")

    assert without_name(answer.opening or "") == "I hear you. Keep going."


async def test_everyday_talk_that_is_all_religious_is_written_again_then_left_to_the_page() -> None:
    claim = ChatReply.model_validate({"reply": "Every good deed is rewarded tenfold."})
    chat = FakeChat(
        classified(intent="feelings", talk=True), [SHAPED], chat=claim, religious=["talk 1"]
    )
    answer = await rafiq(chat).run("I feel good today.", "en")

    talk_calls = [system for system in chat.systems if CONVERSATION in system]
    assert len(talk_calls) == graph_module.MAX_ATTEMPTS
    assert answer.kind == "chat"
    assert answer.opening is None
    assert not answer.referred


# Voice.


@pytest.mark.parametrize(
    "line",
    [
        "Great question!",
        "That is a good thing to ask.",
        "It's natural to wonder about this.",
        "Is this clear?",
        "Does that make sense?",
        "I hope this helps.",
        "أهلاً بك. سؤالك عن شرب القهوة مهم.",
        "من الطبيعي أن ترغب في معرفة المزيد عنه.",
        "هل هذه الإجابة واضحة لك؟",
        "هل كان هذا واضحًا لك؟",
    ],
)
def test_stock_framing_and_stock_closings_are_recognised(line: str) -> None:
    assert any(is_stock(sentence) for sentence in [line, *line.split(". ")])


@pytest.mark.parametrize(
    "line",
    ["Slow is still moving.", "Shall we look at what breaks wudu next?", "تعلّمت اليوم خطوة جديدة."],
)
def test_ordinary_lines_are_not_stock(line: str) -> None:
    assert not is_stock(line)


def test_a_reply_may_not_open_or_close_as_the_previous_one_did() -> None:
    history = [
        Turn(role="user", text="Hi"),
        Turn(
            role="assistant", text="Let us look at it together.\n…\nShall we try the next lesson?"
        ),
    ]
    lines = {
        "opening": "Let us look at it together, step by step.",
        "followUp": "Shall we try the next lesson?",
    }
    assert voiced(lines, history, "en") == {}
    fresh = {"opening": "Here is the short version.", "followUp": "Want an example?"}
    assert voiced(fresh, history, "en") == fresh


def test_the_name_comes_now_and_then_and_never_twice_in_a_row() -> None:
    def turns(*named: bool) -> list[Turn]:
        history: list[Turn] = []
        for used in named:
            history += [
                Turn(role="user", text="…"),
                Turn(role="assistant", text="Hello, {{name}}." if used else "Hello."),
            ]
        return history

    assert name_due(turns())
    assert not name_due(turns(True))
    assert not name_due(turns(True, False))
    assert name_due(turns(True, False, False))
    assert not name_due(turns(False, False, True))
    lines = {"encouragement": "You are doing well.", "followUp": "Want to go on?"}
    assert voiced(lines, turns(), "en")["encouragement"] == "You are doing well, {{name}}."
    assert voiced(lines, turns(), "ar")["encouragement"].startswith("يا {{name}}، ")
    assert all("{{name}}" not in line for line in voiced(lines, turns(True), "en").values())


# The shape of a religious answer.


async def test_a_religious_answer_is_the_answer_then_the_source_then_the_explanation() -> None:
    answer = await rafiq(FakeChat(classified(), [SHAPED])).run(QUESTION, "en")

    assert [block.type for block in answer.blocks] == ["text", "quran", "text"]
    first, _, last = answer.blocks
    assert isinstance(first, TextBlock)
    assert isinstance(last, TextBlock)
    assert first.role == "answer"
    assert "set order" in first.text
    assert last.role == "explanation"
    assert "The order matters" in last.text
    # No praise and no encouragement line: at most one next step.
    assert answer.encouragement is None
    assert answer.follow_up == "Shall we look at what breaks wudu next?"


def test_the_marker_rule_is_per_paragraph_in_the_explanation() -> None:
    units = explanation_units(
        ["Wudu is washing. It comes before prayer [1]. You learn it by doing."]
    )
    assert units[0].sentences[-1].endswith("[1].")
    problems = code_problems(units, [book(1, "Wudu is the washing before prayer.")])
    assert [p.kind for p in problems if p.kind == "unmarked"] == []
    direct = code_problems(
        parse("Wudu is the washing done before prayer. It is short [1]."), [book(1, "x")]
    )
    assert [p.kind for p in direct] == []


async def test_an_explanation_sentence_with_an_unstated_claim_is_written_again_then_removed() -> (
    None
):
    # Items: 1 the answer sentence, 2 and 3 the two explanation sentences.
    chat = FakeChat(classified(), [SHAPED], unsupported=[3])
    answer = await rafiq(chat).run(QUESTION, "en")

    drafts = [user for user in chat.users if "Passages:" in user]
    assert len(drafts) == 2
    assert "explanation sentence is not supported" in drafts[1]
    assert any("Item 3 (explanation sentence)" in user for user in chat.users)
    texts = [block.text for block in answer.blocks if block.type == "text"]
    assert any("Wudu is the washing" in text for text in texts)
    assert not any("The order matters" in text for text in texts)
    assert not answer.referred


async def test_a_reply_that_is_only_a_source_is_written_again_then_shown_with_an_honest_card() -> (
    None
):
    bare = Draft(relevant=[1, 2], answer="This verse is about it [2].", show=["{{quran:2:256}}"])
    chat = FakeChat(classified(), [bare])
    answer = await rafiq(chat).run("What does the verse on compulsion say?", "en")

    drafts = [user for user in chat.users if "Passages:" in user]
    assert len(drafts) == 2
    assert "explains nothing" in drafts[1]
    assert answer.referral is not None
    assert answer.referral.reason == "unexplained"
    assert [block.type for block in answer.blocks] == ["quran"]


# The relevance gate.


def test_only_verses_and_hadiths_of_relevant_passages_are_shown() -> None:
    from app.rafiq.graph import _shown_relevant

    from .fakes import verse

    passages = [book(1, "A book passage."), verse(2, "2:256", "لا إكراه", "No compulsion")]
    draft = Draft(relevant=[1], answer="x [1].", show=["{{quran:2:256}}", "{{term:x}}"])
    assert _shown_relevant(draft, passages).show == []
    draft = Draft(relevant=[1, 2], answer="x [1].", show=["{{quran:2:256}}", "{{term:x}}"])
    assert _shown_relevant(draft, passages).show == ["{{quran:2:256}}"]


def test_a_vocative_belongs_only_to_arabic() -> None:
    lines = {"encouragement": "Ya {{name}}, you are doing well."}
    assert voiced(lines, [], "en")["encouragement"] == "{{name}}, you are doing well."
    arabic = {"encouragement": "يا {{name}}، أنت تتقدم."}
    assert voiced(arabic, [], "ar") == arabic


async def test_no_relevant_passage_widens_the_search_once_then_says_so_honestly() -> None:
    retriever = WideningRetriever()
    nothing = Draft(relevant=[], talk="")
    chat = FakeChat(classified(searchPhrases=["سجادة الصلاة", "prayer mat"]), [nothing])
    answer = await rafiq(chat, retriever).run("What is a prayer mat?", "en")

    assert retriever.widened == [["سجادة الصلاة", "prayer mat"]]
    assert answer.referral is not None
    assert answer.referral.reason == "noSource"
    assert answer.blocks == []


async def test_an_answer_beside_the_question_is_never_shown() -> None:
    chat = FakeChat(classified(), [SHAPED], off_topic=[True])
    answer = await rafiq(chat).run("What is a prayer mat?", "en")

    drafts = [user for user in chat.users if "Passages:" in user]
    assert len(drafts) == 2
    assert "does not respond to the question" in drafts[1]
    assert answer.referral is not None
    assert answer.referral.reason == "noSource"
    assert answer.blocks == []


async def test_a_relevant_answer_is_not_widened() -> None:
    retriever = WideningRetriever()
    await rafiq(FakeChat(classified(), [SHAPED]), retriever).run(QUESTION, "en")
    assert retriever.widened == []


# The committee's behaviour rules.


@pytest.mark.parametrize(
    ("flags", "rule"),
    [
        ({"misconception": True}, "corrects it gently"),
        ({"hostileTone": True}, "Find the actual question"),
        ({"plainTerm": True}, "plain, everyday words first"),
        ({"consensus": True}, "never imply an agreement"),
        ({"worshipWorry": True}, "reassurance"),
    ],
)
async def test_each_behaviour_rule_reaches_the_answer_prompt(
    flags: dict[str, object], rule: str
) -> None:
    chat = FakeChat(classified(**flags), [SHAPED])
    await rafiq(chat).run(QUESTION, "en")
    generate = next(
        system
        for system in chat.systems
        if "Reply with one JSON object" in system and "relevant" in system
    )
    assert rule in generate


async def test_a_question_about_agreement_is_treated_as_a_disputed_matter() -> None:
    answer = await rafiq(FakeChat(classified(consensus=True), [SHAPED])).run(
        "Do all Muslims agree on this?", "en"
    )
    assert answer.referral is not None
    assert answer.referral.reason == "disputed"


def test_a_claimed_agreement_or_a_picked_winner_fails_unless_a_passage_says_so() -> None:
    plain = [book(1, "Wudu is washing before prayer.")]
    agreed = [book(1, "The scholars agree that wudu comes before prayer.")]
    claim = parse("All scholars agree that wudu comes before prayer [1].")
    assert [p.kind for p in code_problems(claim, plain)] == ["consensus"]
    assert code_problems(claim, agreed) == []
    winner = parse("The correct view is that it is required [1].")
    assert [p.kind for p in code_problems(winner, agreed)] == ["tarjih"]
    assert [p.kind for p in code_problems(parse("والراجح أنه واجب [1]."), agreed)] == ["tarjih"]


async def test_a_text_asked_about_as_a_verse_that_is_not_one_is_said_to_be_not_found() -> None:
    chat = FakeChat(classified(quotedVerse="النظافة من الإيمان", asksIfQuoted=True), [SHAPED])
    answer = await rafiq(chat).run("Is «النظافة من الإيمان» a verse?", "en")

    assert answer.referral is not None

    assert answer.referral.reason == "verseNotFound"
    assert answer.blocks == []
    assert not passages_asked(chat)


async def test_a_personal_case_outside_the_kingdom_leads_the_card_with_that() -> None:
    chat = FakeChat(classified(personalCase=True, level="D", outsideKingdom=True), [SHAPED])
    answer = await rafiq(chat).run("I live in Germany; may I do this in my marriage?", "en")

    assert answer.referral is not None
    assert answer.referral.reason == "personalCase"
    assert answer.referral.region == "outside"


# Time.


async def test_a_question_that_runs_out_of_time_gets_the_could_not_verify_in_time_card(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class Slow(FakeChat):
        async def json[T: BaseModel](self, system: str, user: str, schema: type[T]) -> T:
            await asyncio.sleep(1)
            return await super().json(system, user, schema)

    monkeypatch.setattr(graph_module, "TIME_BUDGET", 0.05)
    answer = await rafiq(Slow(classified(), [SHAPED])).run(QUESTION, "ar")

    assert answer.referral is not None

    assert answer.referral.reason == "timeout"
    assert answer.language == "ar"
