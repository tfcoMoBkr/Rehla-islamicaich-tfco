# Curriculum map — Khutuwat (خطوات)

Status: **proposed, pending scholarly review**. Nothing in this file is lesson content. It defines the order of lessons, how a lesson is experienced, and where each lesson's text, evidence and suggested video come from.

**Where lesson content comes from.** Lessons use only the sources the challenge organisers list (`content/sources.json`). A lesson has three layers:

1. **Text.** A card, a guided step or a post-rak'ah line shows one of these:
   - **Book text, verbatim.** It points at a stored paragraph of an approved book (`textRef`: book, section, paragraph and an exact excerpt), and the engine shows that excerpt word for word. A test checks every excerpt against the stored paragraph byte for byte.
   - **Team wording, labelled.** Where no approved book states the card's point in both Arabic and English, the card keeps the team's wording with the visible label «صياغة فريق رحلة» / "Wording by the Rehla team". It rests only on its verse or hadith; a team-worded card without one is removed.
2. **Evidence.** Qur'an verses (quranenc.com) and hadiths with grade, attribution and explanation (hadeethenc.com) are fetched verbatim by script and never typed. A hadith is used only if it has both an Arabic and an English version.
3. **Practice.** Checks, activities and questions are built from layers 1 and 2 only. An activity left without enough items is dropped for that lesson; nothing is invented to fill it.

Lesson files live in `content/lessons/drafts/` and carry `"reviewed": false` until a human reviewer approves them. Unreviewed lessons are labelled as drafts and hidden in production. Coding agents may point a card at stored book text, remove text, or add labels; they never write or change lesson wording (CLAUDE.md, rule 1). What changed in the 2026-10 content audit, card by card, is in `docs/CONTENT_REVIEW.md`.

## Sources

| Key | Book | Arabic | English | Used for |
| --- | --- | --- | --- | --- |
| `ibnbaz-lessons` | «الدروس المهمة لعامة الأمة» / Important Lessons for the General Ummah, Ibn Baz | IslamHouse 1871 | IslamHouse 2842316 (risala.prh.gov.sa translation) | Pillars of Islam and faith, tawhid, conditions, pillars, obligations and invalidators of prayer, wudu and its invalidators |
| `ibnbaz-prayer` | «كيفية صلاة النبي صلى الله عليه وسلم» / The Prophet's Manner of Performing Prayer, Ibn Baz | IslamHouse 62675 | IslamHouse 1261 (OCR text: only clean excerpts are used) | How to pray |
| `mukhtasar` | «المختصر المفيد للمسلم الجديد» / New Muslim Guideline, Muhammad al-Shehri | IslamHouse 2831443 (PDF text: damaged paragraphs are not used) | byenah.com 4784 | Introductory points, wudu, ghusl, tayammum |

The stored books are in `content/fetched/books/`. Most Arabic paragraphs of al-Mukhtasar al-Mufid are damaged by PDF extraction (missing letters, scrambled order), and many English pages of 1261 are OCR-damaged. Such paragraphs are never quoted, which is why several cards keep labelled team wording.

Suggested videos are published on IslamHouse.com by Osoul Center. The IslamHouse page is the primary link, and the file plays from IslamHouse's own servers. Only the two demonstration lessons have one: wudu (2.4) and prayer (3.4).

## How a lesson is experienced

The lesson is the interactive experience. Video is not part of the lesson flow.

Every lesson has the same six parts, so the learner always knows where they are:

1. **Recap.** One card recalling the previous lesson, then «زاد الطريق» / "Provisions": up to three review questions from earlier lessons.
2. **Idea cards.** Short cards, one idea each: book text verbatim, or labelled team wording with its verse or hadith. A card may be followed by one unscored check.
3. **Signature activity.** The interaction listed for the lesson in the tables below, when the lesson's text gives it enough items.
4. **A small situation.** One everyday application question whose answer is in the lesson text, when the lesson has one.
5. **Explain it to Rafiq.** The learner explains the lesson in their own words; Rafiq replies only with what is and is not covered by the lesson text, citing it. It never judges the learner's statement as religiously right or wrong. Hidden when the `rafiq` flag is off.
6. **Close.** Summary, journal stamp, the books the lesson quotes, and a **suggested video** card where one exists.

Under its title, every fiqh lesson (stations 2 and 3) shows a fixed line naming the books it follows, saying that scholars differ on some of its details, and linking to the matching sections of the fiqh encyclopedia on dorar.net (`content/fiqh-encyclopedia.json`).

## Question system

| Level | When | Scored | Behaviour |
| --- | --- | --- | --- |
| Check | After an idea card | No | Immediate feedback quoting the card |
| Provisions | Start of each lesson | No | Spaced review of earlier lessons, missed questions first |
| Quiz | At the marked points (🔹) below | Yes | Shows score and every question; Rafiq explains each wrong answer from the lesson text with its source |
| What do I know? | Start of each station | Yes, not shown as pass/fail | Baseline for the understanding gain |
| Station exam | End of each station | Yes | Same objectives as the baseline; unlocks the next station; journal shows the gain |

Question types: single choice, multiple choice, true/false, ordering, matching, sorting into groups. Every question stores `sourceQuote` (the card that answers it), `lessonId`, `objective` and `reviewed`. No question treats a point on which scholars differ as having one right answer.

## Station 1 — البداية / The Beginning

| # | Lesson (ar / en) | Text quoted | Signature activity |
| --- | --- | --- | --- |
| 1.1 | أعظم نعمة في الوجود / The greatest blessing | team wording with its evidence | First page of the journal: the learner picks the card that speaks to them most (stored on device only) |
| 1.2 | شهادة أن لا إله إلا الله / No deity but Allah | `ibnbaz-lessons` | The two halves of the testimony: sort phrases under "negation" or "affirmation" |
| 1.3 | شهادة أن محمدًا رسول الله / Muhammad is the Messenger of Allah 🔹 | `ibnbaz-lessons` | Timeline of the Prophet's life ﷺ |
| 1.4 | أركان الإسلام الخمسة / The five pillars of Islam | `ibnbaz-lessons` | Five lanterns on the road |
| 1.5 | أركان الإيمان الستة / The six pillars of faith | `ibnbaz-lessons`, `mukhtasar` | Match each pillar to its meaning |
| 1.6 | حياتك الجديدة / Your new life 🔹 | team wording with its evidence | "My first steps" checklist |

## Station 2 — الطهارة / Purification

| # | Lesson (ar / en) | Text quoted | Signature activity | Suggested video |
| --- | --- | --- | --- | --- |
| 2.1 | معنى الطهارة / The meaning of purification | team wording with its evidence | Sort the lesson's examples | — |
| 2.2 | التطهر من النجاسة وآداب قضاء الحاجة / Removing impurity | team wording with its evidence | dropped: no approved text for its items | — |
| 2.3 | الحدث الأصغر ونواقض الوضوء / What breaks wudu 🔹 | `ibnbaz-lessons`, `mukhtasar` | "Is my wudu still valid?" swipe | — |
| 2.4 | كيف أتوضأ؟ / How do I perform wudu? | `ibnbaz-lessons`, `mukhtasar` | **Wudu sequencer**, then "wudu with me" step by step | IslamHouse ar 2834583 · en 2834586 |
| 2.5 | الغسل والتيمم / Ghusl and tayammum 🔹 | `mukhtasar` | Match and order | — |

## Station 3 — الصلاة / Prayer

| # | Lesson (ar / en) | Text quoted | Signature activity | Suggested video |
| --- | --- | --- | --- | --- |
| 3.1 | منزلة الصلاة وفضلها / The status and virtues of prayer | team wording with its evidence | Collect the virtues | — |
| 3.2 | شروط الصلاة ومكانها / Conditions and place of prayer | `ibnbaz-lessons` | "Am I ready to pray?" checklist and decision path | — |
| 3.3 | الصلوات الخمس وأوقاتها / The five prayers and their times 🔹 | team wording with its evidence | **The day arc** | — |
| 3.4 | كيف أصلي؟ / How do I pray? | `ibnbaz-lessons`, `ibnbaz-prayer`, `mukhtasar` | **Build a rak'ah**, then a full prayer step by step | IslamHouse ar 2832089 · en 2838921 |
| 3.5 | معنى سورة الفاتحة / The meaning of Al-Fatihah 🔹 | `ibnbaz-lessons`; each ayah's meaning is التفسير الميسر (Arabic) or the english_saheeh translation (English), from quranenc.com | **Ayah by ayah**: tap an ayah to see its published meaning and hear it (mp3quran.net) | — |
| 3.6 | أركان الصلاة وواجباتها ومبطلاتها / Pillars, obligations and invalidators | `ibnbaz-lessons` (Ibn Baz's own lists) | Sort the lesson's items into groups | — |
| 3.7 | صلاة الجماعة / Congregational prayer | team wording and hadith | dropped: no book states the late-arrival cases | — |
| 3.8 | صلاة الجمعة / The Friday prayer 🔹 | `ibnbaz-lessons` | Swipe | — |

## Stations 4 and 5 (after the first three are complete)

| Station | Topics |
| --- | --- |
| 4 — حياتي اليومية / Daily life | Food and drink, clothing |
| 5 — حياتي الجديدة / My new life | Character, family |

Their text will come from the approved books in the same way: verbatim by reference, or labelled team wording resting on a verse or hadith.

## Rules for building lessons from this map

1. Every card shows book text verbatim by reference or labelled team wording; every activity item and question comes from the lesson's own cards and evidence. If the text does not give enough items for an activity, the activity is dropped for that lesson.
2. Qur'an verses are rendered from quranenc.com by reference, each with its translation's name and version; recitation audio comes from mp3quran.net. Neither is generated.
3. A point on which scholars differ is either shown verbatim from an approved book or removed, together with any question that treats it as settled.
4. Illustrations are abstract inline SVG. No depiction of faces.
5. A lesson with no suggested video in the learner's language simply has no video card.

## Review checklist (human)

- [ ] Each team-worded card read against its verse or hadith (`docs/CONTENT_REVIEW.md`).
- [ ] Each Arabic–English pair of al-Mukhtasar al-Mufid checked (`docs/CONTENT_REVIEW.md`).
- [ ] The two IslamHouse videos watched end to end.
- [ ] The fiqh encyclopedia sections linked under each fiqh lesson opened and confirmed.
- [ ] Objectives that no card covers any more (listed in `docs/CONTENT_REVIEW.md`) given approved text or removed.
