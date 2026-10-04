# Curriculum map — Khutuwat (خطوات)

Status: **proposed, pending scholarly review**. Nothing in this file is lesson content. It defines the order of lessons, how a lesson is experienced, and where each lesson's text and suggested video come from. Lesson text is copied verbatim from the text source; it is never written or paraphrased by a model.

## Sources

| Key | Source | Role | Verified | Open point |
| --- | --- | --- | --- | --- |
| NMG | «دليل المسلم الجديد» / The New Muslim Guide, Fahd Salem Bahammam — https://newmuslimguide.com (ar, en); book also on https://islamhouse.com/en/books/2838874 | Lesson text in both languages, lesson order | Table of contents read on 2026-10-04 | Site footer says "All rights reserved, Modern Guide Company". Permission or the IslamHouse reuse terms must be confirmed before publishing text. |
| ZADI | منصة زادي للتعليم الشرعي المفتوح — https://www.youtube.com/@zadilearning (verified channel). Programme «حقيبة دليل المسلم الميسر», presented by Dr. Fahd Bahammam, 2–6 min each | Suggested video, Arabic | Channel, playlists and video IDs read on 2026-10-04 | Not named in the challenge source list: ask the scholarly mentor to approve it. |
| GTI | Guide To Islam (Osoul Global Center) — https://www.youtube.com/@Guidetoislam; the same videos are on IslamHouse: wudu https://islamhouse.com/en/videos/2834586/, prayer https://islamhouse.com/en/videos/2838921/, shahada https://islamhouse.com/en/videos/2822062/ | Suggested video, English | Read on 2026-10-04 | Cite the IslamHouse page as the source. |

NMG text URLs below are the Arabic pages under `https://newmuslimguide.com`; the English page is the same path under `/en/` (confirm when extracting).

## How a lesson is experienced

The lesson is the interactive experience. Video is not part of the lesson flow.

Every lesson has the same six parts, so the learner always knows where they are:

1. **Recap** — one card recalling the previous lesson, then «زاد الطريق» / "Provisions": up to three review questions from earlier lessons.
2. **Idea cards** — three to six short cards, one idea each, taken verbatim from the lesson text. Each card is followed by one unscored check.
3. **Signature activity** — the interaction listed for the lesson in the tables below.
4. **A small situation** — one everyday application question whose answer is in the lesson text.
5. **Explain it to Rafiq** — the learner explains the lesson in their own words; Rafiq replies only with what is and is not covered by the lesson text, citing it. It never judges the learner's statement as religiously right or wrong. Hidden when the `rafiq` flag is off.
6. **Close** — summary, journal stamp, lesson source, and a **suggested video** card ("to see it explained, watch…") when one exists in the learner's language. The card names the channel and language and opens the video in an in-page YouTube player (`youtube-nocookie.com`). Only the two demonstration lessons (2.4 wudu, 3.4 prayer) show the video before the activity instead of at the close.

## Question system

| Level | When | Scored | Behaviour |
| --- | --- | --- | --- |
| Check | After each idea card | No | Immediate feedback quoting the lesson sentence |
| Provisions | Start of each lesson | No | Spaced review of earlier lessons, missed questions first |
| Quiz | At the marked points (🔹) below | Yes | Shows score and every question; Rafiq explains each wrong answer from the lesson text with its source |
| What do I know? | Start of each station | Yes, not shown as pass/fail | Baseline for the understanding gain |
| Station exam | End of each station | Yes | Same objectives as the baseline; unlocks the next station; journal shows the gain |

Question types: single choice, multiple choice, true/false, ordering, matching, sorting into groups. Every question stores `sourceQuote` (the sentence of the lesson that answers it), `lessonId`, `objective` and `reviewed`. Questions are drafted from the lesson text only and stay hidden in production until `reviewed` is true.

## Station 1 — البداية / The Beginning

| # | Lesson (ar / en) | Text (NMG) | Signature activity | Suggested video (ar · en) |
| --- | --- | --- | --- | --- |
| 1.1 | أعظم نعمة في الوجود / The greatest blessing | /preliminaries/640f63a5e281e | First page of the journal: the learner picks which sentence of the lesson speaks to them most (stored on device only) | `XU1J__TlAcU` · — |
| 1.2 | شهادة أن لا إله إلا الله / No deity but Allah | /categories/your-faith/641a581a7070c | The two halves of the testimony: place each phrase of the lesson under "negation" or "affirmation" | `ZYjFb_Wbxhg` · `Of-J9b7T_AM` |
| 1.3 | شهادة أن محمدًا رسول الله / Muhammad is the Messenger of Allah 🔹 | /categories/your-faith/641a5f9acb1dc | Timeline of the Prophet's life ﷺ: order the stages named in the lesson | `x09xALmClMk` · — |
| 1.4 | أركان الإسلام الخمسة / The five pillars of Islam | /preliminaries/6410daa3a3554 | Five lanterns on the road: light each pillar by matching it to its description | `Q6wjIXFGKVg` · `cCkCvF48z5E` |
| 1.5 | أركان الإيمان الستة / The six pillars of faith | /categories/your-faith/64245f26c664a | Match each pillar to its meaning | playlist `PL57pTpJnA2Q6C0Hy3ew2TeLTieIAS7G5I` · `H1R8OY0JgMs` |
| 1.6 | حياتك الجديدة / Your new life 🔹 | /categories/your-new-life | "My first steps" checklist built from the lesson's own headings | — · — |

## Station 2 — الطهارة / Purification

| # | Lesson (ar / en) | Text (NMG) | Signature activity | Suggested video (ar · en) |
| --- | --- | --- | --- | --- |
| 2.1 | معنى الطهارة / The meaning of purification | /categories/your-purification/66ef8ed845064 | Two kinds of purity: sort the lesson's examples | `Uiw5-B-XG4g` · — |
| 2.2 | التطهر من النجاسة وآداب قضاء الحاجة / Removing impurity | /categories/your-purification/66efccd101c3a | Entering and leaving: order the etiquettes; listen to the two supplications | `E47RDvVR2q8` · — |
| 2.3 | الحدث الأصغر ونواقض الوضوء / What breaks wudu 🔹 | /categories/your-purification/66f37008555b6 | "Is my wudu still valid?" — swipe each case from the lesson to one of two sides | `_HEApaL2NB8` · — |
| 2.4 | كيف أتوضأ؟ / How do I perform wudu? | /categories/your-purification/66f7724f354f9 | **Wudu sequencer**: drag the steps into order, then "wudu with me" guided step by step | `0Z1P1mUm5i4` · `pMOl8qHjwb8` |
| 2.5 | الغسل والتيمم / Ghusl and tayammum 🔹 | /categories/your-purification/66f7724f354f9 (sub-sections) | "Which one do I need?" — decision path using the cases in the lesson | `bZwb_wr9Qp8` · — |

## Station 3 — الصلاة / Prayer

| # | Lesson (ar / en) | Text (NMG) | Signature activity | Suggested video (ar · en) |
| --- | --- | --- | --- | --- |
| 3.1 | منزلة الصلاة وفضلها / The status and virtues of prayer | /categories/your-prayer/66fb8036c398b | Collect the virtues: reveal each virtue and its evidence | `3ni4zVT1TsI` · `ETmbhhpTVi0` |
| 3.2 | شروط الصلاة ومكانها / Conditions and place of prayer | /categories/your-prayer/66fe415de06b4, /6702360956f71 | "Am I ready to pray?" checklist | `5GtS69nP4gY` · — |
| 3.3 | الصلوات الخمس وأوقاتها / The five prayers and their times 🔹 | /categories/your-prayer/6701210bea9dc | **The day arc**: drag the sun from dawn to night and see which prayer's time it is and its number of rak'ahs | `eNiX4-LXUUU` · — |
| 3.4 | كيف أصلي؟ / How do I pray? | /categories/your-prayer/6704bcc2d3c09, /670de63436400 | **Build a rak'ah**: assemble the positions in order, then a full prayer | `MDgtFMR3-fo` · `bkC_79eJa70` |
| 3.5 | معنى سورة الفاتحة / The meaning of Al-Fatihah 🔹 | confirm location in NMG | **Ayah by ayah**: tap an ayah to see its meaning (quranenc.com) and hear it (mp3quran.net) | `HotCPz0Ms_E` · — |
| 3.6 | أركان الصلاة وواجباتها ومبطلاتها / Pillars, obligations and invalidators | /categories/your-prayer/6710620c08dea | Sort the lesson's items into three groups | `zN8z4wt5i6w` · — |
| 3.7 | صلاة الجماعة / Congregational prayer | /categories/your-prayer/671619839466d | "I arrived late": pick what to do in each case from the lesson | `jmGwtzQEvcc` · — |
| 3.8 | صلاة الجمعة / The Friday prayer 🔹 | /categories/your-prayer/671dec2457dc6 | My first Friday: order the steps of the day | `d25gMKkf7kQ` · — |

## Stations 4 and 5 (after the first three are complete)

| Station | Topics (NMG chapters) | Arabic video playlists (ZADI) |
| --- | --- | --- |
| 4 — حياتي اليومية / Daily life | طعامك وشرابك، لباسك | «أحكام الأطعمة» `PL57pTpJnA2Q5NvQHYwxSZPRb_de4uBSuI` |
| 5 — حياتي الجديدة / My new life | أخلاقك، أسرتك | «أخلاق المسلم» `PL57pTpJnA2Q5JAPA55GyAai7Nvy-UY_Fz`; «الأسرة حقوق وواجبات» `PL57pTpJnA2Q5EGwVNbSxCgou7d5R-WUkS` |

## Rules for building lessons from this map

1. Every card, activity item and question is taken from the lesson's approved text and stores the sentence it comes from. If the text does not contain enough items for an activity, the activity is dropped for that lesson; nothing is invented to fill it.
2. Qur'an verses are rendered from quranenc.com by reference; recitation audio comes from mp3quran.net. Neither is generated.
3. Illustrations are original, abstract inline SVG. No depiction of faces.
4. A lesson with no suggested video in the learner's language simply has no video card. The two languages are otherwise identical.
5. Every lesson records `textSource`, `videoSource` and `reviewedBy`.

## Review checklist (human)

- [ ] Scholarly mentor approves ZADI as a video source.
- [ ] Reuse permission for NMG text confirmed.
- [ ] Each suggested video watched end to end by a reviewer.
- [ ] Text location of lessons 1.6 and 3.5 confirmed in the book.
- [ ] Every activity's items checked against the lesson text.
