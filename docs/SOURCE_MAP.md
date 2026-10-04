# Source map — which recommended source is used for what

The challenge's scholarly package (reference list dated 17 Sep 2026) names the sources below. Rehla uses only these. This file says what each one is used for, how it is reached, and what was verified on 2026-10-04.

## Correction to earlier work

The 19 lesson drafts were first written from newmuslimguide.com (Fahd Bahammam). That site is **not** in the organisers' list, and the item "The New Muslim Guide" on IslamHouse (ID 2838874) is a different book (file name `en-new-muslim-guide-sarhan.pdf`). The explanation text of the drafts must therefore be replaced with text taken verbatim from the sources below. The lesson order, activities and question types stay.

## Association platforms (content stated as free for individuals and organisations, with public APIs)

| Source | Use in Rehla | Access | Verified |
| --- | --- | --- | --- |
| quranenc.com | Every verse: Arabic text, English meaning, Arabic explanation | API, no key | API works; translation keys still to be listed |
| hadeethenc.com | Every hadith: text, grade, explanation, benefits, ar + en | API `hadeethenc.com/api/v1`, no key | Works. 26 IDs confirmed; about 20 more to resolve |
| byenah.com | New-Muslim teaching releases (books, leaflets) in ar + en | API `byenah.com/ar/api` | Not opened: the site refuses automated fetches from here (403). Must be opened from the developer's machine |
| islamhouse.com | Lesson text (books below) and videos | API v3, public key in the docs | Works. Reuse: unmodified, with attribution, non-profit (IslamHouse-API README) |
| islamenc.com | Text books and cards with aligned translations | REST, documentation not found yet | Site opens; API not located |
| terminologyenc.com | Definition of every religious term shown to the learner, ar + en | API | Not surveyed yet |
| icadb.com | Sentence-aligned approved translations | `icadb.com/api/docs` requires login | Needs an account |
| risala.prh.gov.sa | Approved English translations of teaching texts | Site | Server error from here; its English edition of "Important Lessons" is reachable through IslamHouse |
| mcp.islamiccontent.org | Rafiq's retrieval over the six platforms above | MCP, no auth | To be connected in the AI service |

## External platforms recommended by the association

| Source | Use in Rehla | Notes |
| --- | --- | --- |
| dorar.net (`/feqhia`, `/aqeeda`, `/tafseer`, `/hadith`, `/history`) | "Details and differences of opinion" link on each fiqh lesson; hadith verification; seerah timeline | Arabic. JSON hadith search documented at dorar.net/article/389. Section URLs still to be collected |
| islamqa.info | "Read more" link per lesson, same answer number in ar and en | All rights reserved: link only, never copied |
| binbaz.org.sa | Arabic source text of Ibn Baz's works; "read more" links | Footer allows copying with attribution |
| binothaimeen.net | "Read more" links | Not surveyed yet |
| Kuwaiti Fiqh Encyclopedia | Term control for fiqh vocabulary | Not surveyed yet |
| tafsir.net | Further reading for Al-Fatihah | Not surveyed yet |
| mp3quran.net | Recitation audio and ayah timings for Al-Fatihah | Public API, no key |
| qurancomplex.gov.sa | Quran font and text reference | Developer platform |
| dictionary.ksaa.gov.sa | Arabic wording checks | — |
| dawa.center/file/7937 «بيّنات» | Rafiq's answers to common doubts; pillars of faith | A 1,251-page Arabic PDF book, not a dataset |
| islamic-content.com/dictionary | Term translation control | Personal non-commercial use: consult, do not copy |

## Texts the lessons will be taken from (verbatim, both languages)

| Text | Arabic | English | Covers |
| --- | --- | --- | --- |
| «الدروس المهمة لعامة الأمة», Ibn Baz | IslamHouse 1871; binbaz.org.sa | IslamHouse 2842316, published by risala.prh.gov.sa: `https://d1.islamhouse.com/data/en/ih_books/single/risala_en-addurus_almuhimmah-2.1.pdf` | Pillars of Islam and faith, tawhid, conditions/pillars/obligations of prayer, wudu, invalidators (per its description; chapter list to confirm after download) |
| «كيفية صلاة النبي ﷺ», Ibn Baz | IslamHouse 62675 | IslamHouse 1261 | How to pray |
| «دليل المسلم الجديد» (Sarhan) | IslamHouse 2838873 | IslamHouse 2838874 | New-Muslim overview; contents to confirm after download |
| Hadith explanations | hadeethenc.com | hadeethenc.com | Evidence and benefits on every card |

Videos: "How to perform wudu" (IslamHouse ar 2834583 / en 2834586) and "How can I pray?" (ar 2832089 / en 2838921), both by Osoul Center.

IslamHouse item call: `https://api3.islamhouse.com/v3/<key>/main/get-item/<id>/<ar|en>/json` (the public key is printed in the API documentation).

## Per-lesson "read more" links already identified (IslamQA answer numbers, same in /ar/ and /en/)

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
