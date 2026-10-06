"""Stand-ins for the model, the embeddings and the MCP server: the tests never use the network."""

import hashlib
import re

import numpy as np
from pydantic import BaseModel

from app.index import Chunk, Index
from app.languages import Language
from app.rafiq.schemas import ChatReply, Classification, Draft, KeywordQueries, SupportCheck
from app.retrieval.passages import HadithText, Passage, VerseText
from app.text import tokens

DIMENSIONS = 64


def vector(text: str) -> np.ndarray:
    """A bag-of-words vector: texts sharing words point the same way."""
    result = np.zeros(DIMENSIONS, dtype=np.float32)
    for token in tokens(text):
        result[int(hashlib.md5(token.encode()).hexdigest(), 16) % DIMENSIONS] += 1.0
    norm = np.linalg.norm(result)
    return result / norm if norm else result


class FakeEmbedder:
    async def embed(self, texts: list[str]) -> np.ndarray:
        return np.stack([vector(text) for text in texts])


class FakeChat:
    """Answers each kind of request from a script; records what it was asked."""

    def __init__(
        self,
        classification: Classification,
        drafts: list[Draft],
        unsupported: list[int] | None = None,
        religious: list[str] | None = None,
        chat: ChatReply | list[ChatReply] | None = None,
        off_topic: list[bool] | None = None,
    ) -> None:
        self.classification = classification
        self.drafts = list(drafts)
        self.unsupported = unsupported or []
        self.religious = religious or []
        # Talk replies in order; the last one repeats.
        replies = (
            chat
            if isinstance(chat, list)
            else [chat or ChatReply(opening="And peace be with you.")]
        )
        self.chats = list(replies)
        # The off-topic verdict of each support check, in order; the last one repeats.
        self.off_topic = list(off_topic or [False])
        self.systems: list[str] = []
        self.users: list[str] = []

    async def json[T: BaseModel](self, system: str, user: str, schema: type[T]) -> T:
        self.systems.append(system)
        self.users.append(user)
        if schema is Classification:
            return self.classification  # type: ignore[return-value]
        if schema is Draft:
            return self.drafts.pop(0) if len(self.drafts) > 1 else self.drafts[0]  # type: ignore[return-value]
        if schema is SupportCheck:
            off = self.off_topic.pop(0) if len(self.off_topic) > 1 else self.off_topic[0]
            check = SupportCheck(
                unsupported=self.unsupported, religious=self.religious, offTopic=off
            )
            return check  # type: ignore[return-value]
        if schema is ChatReply:
            return self.chats.pop(0) if len(self.chats) > 1 else self.chats[0]  # type: ignore[return-value]
        if schema is KeywordQueries:
            return KeywordQueries(queries=[])  # type: ignore[return-value]
        raise AssertionError(f"unexpected schema {schema}")


class DownMcp:
    """An MCP server that cannot be reached: every call comes back empty."""

    def __init__(self) -> None:
        self.calls = 0
        self.tools: list[str] = []

    async def call(self, tool: str, arguments: dict[str, object]) -> str | None:
        self.calls += 1
        self.tools.append(tool)
        return None


class ScriptedMcp(DownMcp):
    """An MCP server that answers each tool with a fixed reply (in the server's own format)."""

    def __init__(self, replies: dict[str, str]) -> None:
        super().__init__()
        self.replies = replies
        self.arguments: list[dict[str, object]] = []

    async def call(self, tool: str, arguments: dict[str, object]) -> str | None:
        await super().call(tool, arguments)
        self.arguments.append(arguments)
        return self.replies.get(tool)


def chunk(**fields: object) -> Chunk:
    text = str(fields["text"])
    defaults: dict[str, object] = {
        "lang": "en",
        "type": "book",
        "sourceId": "byenah-new-muslim-guideline",
        "title": "New Muslim Guideline",
        "reference": "I learn Wudu",
        "url": "https://byenah.com/en/muslim-content/4784",
        "publisher": "byenah.com",
        "hash": hashlib.sha256(text.encode()).hexdigest(),
    }
    return Chunk.model_validate({**defaults, **fields})


WUDU = chunk(
    id="book:wudu:1",
    text="To perform wudu you wash your hands, rinse your mouth, wash your face and your arms, "
    "wipe your head and wash your feet.",
)
VERSE = chunk(
    id="quran:2:256:en",
    type="quran",
    sourceId="quranenc",
    title="The Holy Quran",
    reference="2:256",
    url="https://quranenc.com/en/browse/english_saheeh/2#256",
    publisher="quranenc.com",
    text="There shall be no compulsion in [acceptance of] the religion.",
    extra={
        "surah": 2,
        "ayah": 256,
        "arabic": "لَآ إِكۡرَاهَ فِي ٱلدِّينِۖ",
        "translation": "There shall be no compulsion in [acceptance of] the religion.",
        "translationKey": "english_saheeh",
        "translationVersion": "1.1.2",
    },
)


def index(*chunks: Chunk) -> Index:
    return Index(list(chunks), np.stack([vector(f"{c.title} {c.text}") for c in chunks]))


def markers(text: str) -> list[int]:
    return [int(found) for found in re.findall(r"\[(\d+)\]", text)]


# Passages for the shape suite. Their words are placeholders, not religious texts.


def book(n: int, text: str, lang: Language = "en") -> Passage:
    return Passage(
        n=n,
        type="book",
        lang=lang,
        source_id="test-book",
        title="Test book",
        reference=f"Section {n}",
        url=f"https://example.org/book/{n}",
        publisher="example.org",
        text=text,
    )


def term(n: int, text: str) -> Passage:
    return book(n, text).model_copy(update={"type": "term", "source_id": "terminologyenc"})


def hadith(n: int, hadith_id: int, arabic: str, text: str | None, lang: Language = "en") -> Passage:
    return Passage(
        n=n,
        type="hadith",
        lang=lang,
        source_id="hadeethenc",
        title=f"Narration {hadith_id}",
        reference=f"#{hadith_id}",
        url=f"https://hadeethenc.com/{lang}/browse/hadith/{hadith_id}",
        publisher="HadeethEnc.com",
        text=text or arabic,
        hadith=HadithText(
            id=hadith_id,
            title=f"Narration {hadith_id}",
            arabic=arabic,
            text=text,
            text_language=lang if text else None,
            grade="Graded",
            attribution="Recorded by a collector",
            explanation="The publisher's explanation of the narration.",
            url=f"https://hadeethenc.com/{lang}/browse/hadith/{hadith_id}",
        ),
    )


def verse(n: int, ref: str, arabic: str, translation: str | None) -> Passage:
    surah, ayah = (int(part) for part in ref.split(":"))
    return Passage(
        n=n,
        type="quran",
        lang="en" if translation else "ar",
        source_id="quranenc",
        title="The Holy Quran",
        reference=ref,
        url=f"https://quranenc.com/en/browse/english_saheeh/{surah}#{ayah}",
        publisher="QuranEnc.com",
        text=f"{arabic}\n{translation}" if translation else arabic,
        verse=VerseText(
            ref=ref,
            surah=surah,
            ayah=ayah,
            arabic=arabic,
            translation=translation,
            translation_language="en" if translation else None,
            translation_key="english_saheeh" if translation else None,
            translation_name="English Translation" if translation else None,
            translation_version="1.1.2" if translation else None,
            url=f"https://quranenc.com/en/browse/english_saheeh/{surah}#{ayah}",
        ),
    )
