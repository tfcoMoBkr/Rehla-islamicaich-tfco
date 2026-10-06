"""What a question is, read from its words in code, whatever the classifier said: the readings the
reliability policy depends on, so they never rest on a model's judgement alone.

- Asking whether Muslims or scholars agree, or which school is right: a disputed matter (level C).
- A heavy question about one's own standing, prayer, marriage or divorce: a personal case (level D).
- What a named scholar says, a judgement on a person or a group, a ruling on finance, evidence for
  one side of a ruling, or a request to write a hadith or verse: referred at once, nothing written.
- The learner's own name, city or workplace: never repeated back.
- A text asked about as a hadith or a verse in plain words ("hadith …", "…, is it a hadith?",
  "…, right?"): looked up, and said plainly when it is not found.
"""

import re

AGREEMENT_ASKED = re.compile(
    r"يتفق|يتفقون|متفقون|اتفق|أجمع|إجماع|\bconsensus\b|\bagree\b|\ball\s+(?:muslims|scholars)\b",
    re.IGNORECASE,
)
WHICH_SCHOOL = re.compile(
    r"المذهب\s+الصحيح|أي\s+المذاهب|أصح\s+المذاهب|المذهب\s+الأصح"
    r"|\bwhich\s+(?:madhhab|madhab|school)\b|\b(?:right|correct|true)\s+(?:madhhab|madhab)\b",
    re.IGNORECASE,
)
HEAVY_PERSONAL = re.compile(
    r"هل\s+(?:أنا|انا)\s+(?:مسلم|كافر|مرتد)|هل\s+(?:ما\s+)?(?:زلت|مازلت)\s+مسلم|تركت\s+الصلاة"
    r"|زوجتي|زوجي|زواجي|زواجنا|طلقت|طالق|طلاق|\bam\s+i\s+(?:still\s+)?(?:a\s+)?muslim\b"
    r"|\bi\s+(?:left|stopped|abandoned)\s+(?:the\s+)?pray|\bmy\s+(?:wife|husband|marriage)\b"
    r"|\bdivorce",
    re.IGNORECASE,
)
REFER_AT_ONCE = re.compile(
    # What a named scholar says or thinks, or whether he is right.
    r"(?:الشيخ|شيخ|الإمام|العالم)\s+\S+[^؟?.]{0,40}(?:يقول|قال|رأي|يرى|على\s+حق)"
    r"|رأيك\s+في\s+(?:الشيخ|شيخ|الإمام)"
    r"|\b(?:sheikh|shaykh|shaikh|imam)\s+\w+[^?.]{0,40}\b(?:say|says|said|think|view|opinion|right)\b"
    # A judgement on a person or a group.
    r"|(?:هل|is|are)\b[^؟?.]{0,40}(?:كفار|كافر|كافرون|مرتد|مبتدع|ضال|ضالون|زنادقة)"
    r"|\b(?:is|are)\b[^?.]{0,40}\b(?:kafirs?|kuffar|disbelievers|apostates?|heretics?|deviants?)\b"
    # A ruling on finance.
    r"|عملات?\s+(?:رقمية|مشفرة)|بيتكوين|كريبتو|فوركس|تداول\s+(?:الأسهم|العملات)"
    r"|\b(?:crypto\w*|bitcoin|forex|day\s+trading|stock\s+trading)\b"
    # Evidence for one side of a ruling.
    r"|(?:حديث|دليل|آية)[^؟?.]{0,30}(?:يبيح|يحرم|يحلل|يجيز)"
    r"|\b(?:hadith|evidence|verse)\b[^?.]{0,30}\b(?:permit|permits|allow|allows|forbid|forbids)\b"
    # A request to write a hadith, a verse or a supplication.
    r"|(?:اكتب|ألف|ألّف|أنشئ|اخترع|اصنع)\s[^؟?.]{0,20}(?:حديث|آية|دعاء)"
    r"|\b(?:write|make\s+up|invent|compose)\b[^?.]{0,20}\b(?:hadith|verse|du['’]?a)\b",
    re.IGNORECASE,
)
DETAIL = re.compile(
    r"(?:اسمي|إسمي)\s+(\S+)|(?:أسكن|اسكن|أعيش|اعيش|أقيم)\s+(?:في\s+)?(\S+)|(?:أعمل|اعمل)\s+(?:في|لدى)\s+(\S+)"
    r"|\bmy\s+name\s+is\s+(\w+)|\bi\s+(?:live|stay)\s+in\s+(\w+)|\bi\s+work\s+(?:at|for)\s+(\w+)",
    re.IGNORECASE,
)
LEADING = re.compile(r"^\s*(?:حديث|hadith)\s*[:：]?\s*(.{6,200}?)\s*[؟?.]?\s*$", re.IGNORECASE)
TRAILING = re.compile(
    r"^\s*(.{4,200}?)\s*[،,]\s*(?:هل\s+(?:هو|هي|هذا|هذه)\s+(حديث|آية)"
    r"|(?:is|was)\s+(?:it|this|that)\s+a\s+(hadith|verse))\s*[؟?]?\s*$",
    re.IGNORECASE,
)
CORRECT = re.compile(
    r"^\s*(.{4,200}?)\s*[،,]\s*(?:صح|صحيح|is\s+that\s+right|right)\s*[؟?]\s*$", re.IGNORECASE
)


def disputed_by_form(question: str) -> bool:
    return bool(AGREEMENT_ASKED.search(question) or WHICH_SCHOOL.search(question))


def personal_by_form(question: str) -> bool:
    return bool(HEAVY_PERSONAL.search(question))


def referred_at_once(question: str) -> bool:
    return bool(REFER_AT_ONCE.search(question))


def personal_details(question: str) -> list[str]:
    """The name, city or workplace the learner typed about themselves."""
    found = [group for match in DETAIL.finditer(question) for group in match.groups() if group]
    return [word.strip("،,.؟?!") for word in found if len(word.strip("،,.؟?!")) > 1]


def asked_text(question: str) -> tuple[str, str | None, bool] | None:
    """A text asked about as a hadith or a verse in plain words: the text, "hadith" or "verse" (or
    None when the question does not say), and whether it asks if the text is one."""
    if match := LEADING.match(question):
        return match.group(1).strip(), "hadith", True
    if match := TRAILING.match(question):
        word = (match.group(2) or match.group(3) or "").lower()
        kind = "hadith" if word in ("حديث", "hadith") else "verse"
        return match.group(1).strip(), kind, True
    if match := CORRECT.match(question):
        return match.group(1).strip(), None, False
    return None
