# Source map — which recommended source is used for what

The challenge's scholarly package (reference list dated 17 Sep 2026) names the sources below. Rehla uses only these. This file says what each one is used for, how it is reached, and what was verified. `content/sources.json` is the full list shown on the sources page, with licence notes.

## Correction after the content audit

The 19 lesson drafts were first worded by the team from a lesson website that is **not** on the organisers' list. After an external audit (2026-10), every link to that site and every reference to it as a source were removed. Its wording now survives only where it is labelled «صياغة فريق رحلة» / "Wording by the Rehla team" and rests on a verse or hadith fetched from the approved encyclopedias.

- **Verbatim text.** Wherever an approved book states a card's point in both Arabic and English, the card now shows that book's text verbatim by reference (`textRef`).
- **Removed text.** Points on which scholars differ were shown verbatim or removed.

The lesson order, activities and question types stay where their items survived. The IslamHouse item 2838873/2838874 ("The New Muslim Guide", Haitham Sarhan) is a different book whose PDFs have no text layer. It is not used and is not listed among the visible sources. Every change is listed in `docs/CONTENT_REVIEW.md`.

## Association platforms (content stated as free for individuals and organisations, with public APIs)

| Source | Use in Rehla | Access | Reuse conditions |
| --- | --- | --- | --- |
| quranenc.com | Every verse: Arabic text, English translation, التفسير الميسر for ayah-by-ayah readings; Rafiq's Urdu, Bengali and French translations | API, no key | Seven published conditions (no modification, name the publisher and source, give the version, …), recorded verbatim in `content/sources.json` |
| hadeethenc.com | Every hadith: text, grade, attribution, explanation, ar + en | API `hadeethenc.com/api/v1`, no key | No conditions published beyond "free through all available means"; the organisers' package applies |
| islamhouse.com | The lesson books below and the two suggested videos | API v3 (public key in its documentation) | Unmodified, with attribution, non-profit use (IslamHouse-API README) |
| byenah.com | English edition of al-Mukhtasar al-Mufid | Downloaded DOCX | The organisers' package applies |
| terminologyenc.com | Definitions of religious terms, ar + en | API | The organisers' package applies |
| mcp.islamiccontent.org | Rafiq's live retrieval of verses and hadiths | MCP, no auth | Shown with text and link exactly as returned; nothing stored |

## External platforms recommended by the association

| Source | Use in Rehla | Notes |
| --- | --- | --- |
| dorar.net (`/feqhia`) | The fixed line under each fiqh lesson links to its sections in the fiqh encyclopedia | Link only; nothing copied |
| islamqa.info, binbaz.org.sa, binothaimeen.net, tafsir.net | "Read more" links | Link only; nothing copied |
| mp3quran.net | Recitation audio and ayah timings; surah names in Rafiq's answer languages | Public API, no key; audio streamed from its servers |

## Texts the lessons quote (verbatim, both languages)

| Text | Arabic | English | Covers |
| --- | --- | --- | --- |
| «الدروس المهمة لعامة الأمة», Ibn Baz | IslamHouse 1871 | IslamHouse 2842316 (risala.prh.gov.sa) | Pillars of Islam and faith, tawhid, conditions, pillars, obligations and invalidators of prayer, wudu and its invalidators |
| «كيفية صلاة النبي صلى الله عليه وسلم», Ibn Baz | IslamHouse 62675 | IslamHouse 1261 (OCR; only clean excerpts) | How to pray |
| «المختصر المفيد للمسلم الجديد», Muhammad al-Shehri | IslamHouse 2831443 (PDF; damaged paragraphs are not used) | byenah.com 4784 | Introductory points, wudu, ghusl, tayammum |
| Hadith texts and explanations | hadeethenc.com | hadeethenc.com | Evidence on cards |

All stored books are in `content/fetched/books/` (`node scripts/fetch-content.mjs` and `--lesson-books`).

Videos: "How to perform wudu" (IslamHouse ar 2834583 / en 2834586) and "How can I pray?" (ar 2832089 / en 2838921), both by Osoul Center's scientific team.

## Per-lesson "read more" links (IslamQA answer numbers, same in /ar/ and /en/)

| Lesson | IslamQA |
| --- | --- |
| 1.4 Five pillars | 13569 |
| 1.6 New life | 20267, 373188 |
| 2.2 Impurity and toilet etiquette | 8003 |
| 2.3 What breaks wudu | 14321 |
| 2.4 How to perform wudu | 11497 |
| 2.5 Ghusl / tayammum | 82344 / 21074 |
| 3.1 Status of prayer | 33694 |
| 3.3 Prayer times | 9940 |
| 3.4 How to pray | 13340 |
| 3.6 Pillars and obligations | 65847 |
| 3.7 Congregation | 40113 |
| 3.8 Friday | 13692 |

URL pattern: `https://islamqa.info/<ar|en>/answers/<number>`. Each link must be opened and checked by a reviewer before it is shown.
