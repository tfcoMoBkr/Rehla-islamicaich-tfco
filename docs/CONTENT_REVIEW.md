# Content review — the 2026-10 audit

For the scholarly reviewer. The 19 lesson drafts had been worded by the team from a lesson website that is not on the organisers' list. Under CLAUDE.md rule 1, lesson text could only be (a) pointed at stored text of an approved book by reference, so that it is shown verbatim, (b) removed, or (c) labelled. Nothing below was written or reworded. Each change is listed here so that it can be checked.

- **Verbatim** means that the card, step or line now shows an exact excerpt of an approved book (`textRef`), in both languages. `web/src/lib/content/lesson-text.test.ts` checks every excerpt against the stored paragraph byte for byte.
- **Team** means that no approved book states the point in both Arabic and English, in a clean stored text. The card keeps the team's wording with the visible label «صياغة فريق رحلة» / "Wording by the Rehla team" and rests only on its verse or hadith.
- **Removed** means that the card, sentence, check, activity item or situation was deleted.

## Per lesson

| Lesson | Cards verbatim (book) | Cards team | Cards evidence only | Cards removed | Steps verbatim / team | Activities now |
|---|---|---|---|---|---|---|
| 1.1 | 0 | 4 | 0 | 1 | 0 / 0 | reflection |
| 1.2 | 2 (ibnbaz-lessons) | 3 | 0 | 1 | 0 / 0 | sort |
| 1.3 | 1 (ibnbaz-lessons) | 4 | 0 | 1 | 0 / 0 | timeline, select |
| 1.4 | 1 (ibnbaz-lessons) | 2 | 0 | 2 | 0 / 0 | select |
| 1.5 | 1 (ibnbaz-lessons), 1 (mukhtasar) | 3 | 0 | 2 | 0 / 0 | match |
| 1.6 | 0 | 5 | 0 | 3 | 0 / 0 | select, checklist |
| 2.1 | 0 | 1 | 0 | 4 | 0 / 0 | sort |
| 2.2 | 0 | 1 | 0 | 6 | 0 / 0 | none |
| 2.3 | 2 (mukhtasar), 1 (ibnbaz-lessons) | 1 | 0 | 3 | 0 / 0 | swipe |
| 2.4 | 1 (mukhtasar), 1 (ibnbaz-lessons) | 2 | 0 | 0 | 6 / 3 | order, sort, guided |
| 2.5 | 2 (mukhtasar) | 1 | 0 | 4 | 0 / 0 | match, order |
| 3.1 | 0 | 5 | 0 | 3 | 0 / 0 | select |
| 3.2 | 1 (ibnbaz-lessons) | 5 | 0 | 2 | 0 / 0 | checklist, decisionPath |
| 3.3 | 0 | 6 | 0 | 1 | 0 / 0 | dayArc, match |
| 3.4 | 1 (mukhtasar), 1 (ibnbaz-prayer) | 2 | 0 | 1 | 5 / 7 | order, match, guided |
| 3.5 | 1 (ibnbaz-lessons) | 0 | 0 | 1 | 0 / 0 | ayahByAyah, match |
| 3.6 | 3 (ibnbaz-lessons) | 1 | 0 | 2 | 0 / 0 | sort |
| 3.7 | 0 | 1 | 1 | 5 | 0 / 0 | none |
| 3.8 | 1 (ibnbaz-lessons) | 2 | 1 | 3 | 0 / 0 | swipe |

Books: `ibnbaz-lessons` = Ibn Baz, Important Lessons (1871 / 2842316); `ibnbaz-prayer` = Ibn Baz, How the Prophet prayed (62675 / 1261); `mukhtasar` = al-Mukhtasar al-Mufid (islamhouse-2831443 / byenah-4784).

## Disputed points and other decisions

| Lesson | Card / part | Point | What was done |
|---|---|---|---|
| 1.6 | card c2 + checklist item (card c2) | ghusl on accepting Islam being 'recommended' (A2 list, 2.5) | removed |
| 1.2 | card c2 (team) | The card says «يبتغي بها وجه الله / seeking Allah's pleasure», but its hadith 10098 says «صدقًا من قلبه / sincerely from his heart», not 'seeking Allah's face'. Kept, not reworded: decide whether to delete the card or keep it. | kept as team; flagged |
| 1.6 | card c3 (team) + activity a1 | The three conditions of repentance (stop, regret, resolve) are not in the card's hadith 5344 ('All human beings are sinners, and the best of sinners are those who repent'). No approved book passage covers them. Kept, not reworded. | kept as team; flagged |
| 1.3 | activity a1 (timeline) | Team-written seerah items (born 570 CE, revelation at forty in 610 CE, hijrah 622 CE, died at sixty-three in 632 CE) with no source; the brief did not cover them. | kept; flagged |
| 1.4 | activity a1 (five lanterns) | Its correct items come from the five pillars list, and card c2 that held the list was removed. Kept because the same five items are named in c1's hadith 66512, which is shown verbatim. | kept; flagged |
| 2.2 | card c5 (first sentence) / check | any cleaner removes impurity; no set number of washes | removed (sentence and the 'seven washes' check) |
| 2.2 | card c4 | the dog, next to 'no set number of washes' | removed (card c4 and the dog review note) |
| 2.3 | cards c4, c5, c6 | the list of what breaks wudu («بشهوة», camel meat) | verbatim from islamhouse-2831443 s7 [14] / byenah-4784 s19 [17],[18] and from 1871 t18 [1] / 2842316 s17 [2]; the team's «بشهوة» wording is gone |
| 2.4 | card c4 / check | continuity (الموالاة) in wudu | verbatim from 1871 t17 [1] / 2842316 s16 [2]; true/false check removed |
| 2.4 | steps 3 and 4 | the obligation is once for rinsing the mouth and nose | verbatim in c4 from 1871 t17 [1] / 2842316 s16 [2]; the team sentences in steps 3 and 4 are replaced by Mukhtasar textRefs (s7 [6],[7] / s18 [16],[18]); repeat labels kept |
| 2.5 | card c5 / situation / 2.4 laterTopics | wiping over socks | removed |
| 2.5 | card c7 | tayammum with one strike | verbatim from islamhouse-2831443 s10 [2] / byenah-4784 s22 [2]; order a2 kept |
| 2.5 | - | ghusl on accepting Islam being recommended | not present in the 2.5 file; nothing to change |
| 2.1 | card c4 / sort a2 / situation | wudu required for touching the mushaf and for tawaf | removed (Mukhtasar s7 [3] Arabic is damaged) |
| 2.1 | card c2 | typed Quran wording «والله يحب المتطهرين» | sentence removed; verse 2:222 stays as the card's evidence |
| 2.5 | activity a2 item 3 | the item says 'the backs of my hands' (ظاهر كفيّ); the book text now shown says 'face and palms' (وجهه وكفيه) | kept; reviewer to confirm the item against the book |
| 2.2 | card c5 | team text says a remaining smell does no harm; hadith 8373 speaks only of the mark (أثر) | kept; reviewer to confirm |
| 2.4 | steps.2 repeat / sort a2 | 'three times' for washing the hands to the wrists is team metadata; Ibn Baz's verbatim text names the face, hands to the elbows, feet, mouth and nose only | kept; reviewer to confirm |
| 3.4 | steps.qiraah | hands on the chest in prayer | removed: the step now shows al-Mukhtasar's recitation text (islamhouse-2831443 s11 [9] / byenah-4784 s23 [17]); no other step, check or activity mentions the hands |
| 3.4 | steps.ruku | 'the obligation is once' for the words of bowing | removed: step shows verbatim 62675 t5 [1] / 1261 a1-page-11 [1] (posture only); `say` kept |
| 3.4 | steps.sujud1 | 'the obligation is once' for the words of prostration | removed: step shows verbatim 62675 t6 [1] / 1261 a1-page-14 [1] (the seven parts); `say` kept |
| 3.4 | card c1 | not uttering the intention (team text said 'You do not say it aloud') | not shown: the card now shows al-Mukhtasar verbatim (intention in the heart). Ibn Baz states the point (62675 t3 [1]) but the matching 1261 English is OCR-damaged ('perfonn', soft-hyphen splits) |
| 3.2 | objectives / activity a1 | lesson says 'four conditions'; c1 now shows Ibn Baz's nine | left for the team: objectives and checklist wording not editable under the contract |
| 3.2 | card c2 | team wording 'clothing that is neither tight nor see-through' and the woman's 'awrah in prayer | kept as team text with 7:31; flag for scholarly review |
| 3.3 | card c4 | team says Asr time lasts until sunset; the cited hadith 10596 says 'until the sun turns yellow' | kept as team text; flag for scholarly review |
| 3.3 | cards c2-c6 and match a2 | rak'ah counts rest on no cited text (hadith 10596 gives times only) | kept as team text; flag for review |
| 3.3 | prayers array | times written by the team, outside cards/steps | untouched; not covered by the contract |
| 3.6 | card c1 | classification of pillars | verbatim from 1871 t11 [1] / 2842316 s10 [2] |
| 3.6 | card c2 | classification of obligatory acts | verbatim from 1871 t12 [1] / 2842316 s11 [2] |
| 3.6 | card c2 check | forgotten first tashahhud is made up by the prostration of forgetfulness | removed |
| 3.6 | card c3 | definition of recommended acts (leaving them does not invalidate) | removed |
| 3.6 | card c4 / check | prostration of forgetfulness; in doubt count the lower number | removed |
| 3.6 | card c5 | invalidators of prayer | verbatim from 1871 t15 [2] / 2842316 s14 [2] (first of the eight only) |
| 3.6 | activity a1 item 'القهقهة' | laughing as an invalidator (no longer shown by any card) | removed |
| 3.6 | activity a1 (remaining 7 items) | sort into pillar / obligation / invalidator | kept: every remaining item is in Ibn Baz's lists shown verbatim by c1, c2, c5 |
| 3.6 | situation | forgotten first tashahhud made up by the prostration of forgetfulness | removed (null) |
| 3.7 | activity a1 (all three cases, incl. Fajr second rak'ah and Dhuhr bowing in the third) | late-arrival case | removed: no stored book states the case |
| 3.7 | cards c5, c6, c7 | joining late; rak'ah counts if the bowing is caught; completing after the salam | removed |
| 3.7 | situation | imam in prostration: say the takbir and prostrate with him | removed (null) |
| 3.8 | card c7 / situation | less than one rak'ah of Friday is completed as Dhuhr | removed (situation null) |
| 3.8 | card c4 | Friday bath as 'recommended' | removed |
| 3.6 | card c5 | Ibn Baz's list of the eight invalidators of prayer | verbatim from 1871 t15 [1]–[9] / 2842316 s14 [1]–[9]: the whole list, in place of its first item only |
| 3.5 | ayat (1:1–7) | the team's meaning of each ayah | removed; each ayah now shows التفسير الميسر (QuranEnc arabic_moyassar, no published version number) on Arabic pages and english_saheeh 1.1.2 with its footnotes on English pages, both fetched verbatim |
| 3.5 | situation | a question built on the team's meaning of 1:6 | removed |
| 3.2 | objective; checklist a1 instruction | "the four conditions of prayer", while c1 now shows Ibn Baz's nine | both sentences removed. The team cards c2, c3 and c5 still open with «الشرط الثاني/الثالث/الرابع»; that numbering follows the old four-item list and should be reviewed |
| all | suggested videos | Zadi and Guide To Islam videos | removed; only the wudu (2.4) and prayer (3.4) videos remain, from Osoul Center's IslamHouse pages |

## Arabic–English pairs made for this review

Each pair is a passage of one book in its Arabic and English editions that the lesson treats as stating the same point. The pairs of Ibn Baz's Important Lessons follow the book's own lesson numbers (`content/corpus/books/pairs/important-lessons.json`). The pairs of al-Mukhtasar al-Mufid were made by reading the two editions, because their sections do not correspond; please check these first.

| Book | Arabic | English | Lesson / card | What both state |
|---|---|---|---|---|
| `mukhtasar` **(paired by reading)** | islamhouse-2831443 s6 [14] | byenah-4784 s15 [4] | 1.5 c5 | The call of all the messengers, first to last, was one in the core of the religion: worshipping Allah alone without associating partners (ar «توحيد الله ... في العبادة وعدم الإشراك به»). Section pairing: Arabic s6 (أركان الإيمان) holds all six pillars; English splits them into s11-s17, and s15 is the messengers. |
| `ibnbaz-lessons` | 1871 t8 [3] | 2842316 s7 [3] | 1.2 c4 | Tawhid al-Uluhiyyah is the meaning of La ilaha illa Allah: no true deity but Allah; all worship for Him alone (lesson 4 pair from important-lessons.json). |
| `ibnbaz-lessons` | 1871 t6 [1] | 2842316 s5 [1] | 1.2 c5 | Meaning: 'la ilaha' negates all worshipped besides Allah, 'illa Allah' affirms worship for Allah alone (lesson 2 pair). |
| `ibnbaz-lessons` | 1871 t6 [4] | 2842316 s5 [3] | 1.3 c4 | What the testimony that Muhammad is the Messenger of Allah entails: believe, obey, avoid, worship only as prescribed (lesson 2 pair). |
| `ibnbaz-lessons` | 1871 t6 [1] | 2842316 s5 [1] | 1.4 c3 | The first and greatest of the five pillars is the two testimonies (opening clause of the paragraph only). |
| `ibnbaz-lessons` | 1871 t7 [1] | 2842316 s6 [1] | 1.5 c1 | The pillars of faith are six, listed (lesson 3 pair). |
| `ibnbaz-lessons` | 1871 t17 [1] | 2842316 s16 [2] | 2.4 c4 | six obligations of wudu incl. order and continuity; three times recommended, obligation once; head not repeated (lesson 13, from pairs/important-lessons.json) |
| `ibnbaz-lessons` | 1871 t18 [1] | 2842316 s17 [2] | 2.3 c6 | the six invalidators of wudu (lesson 14) |
| `mukhtasar` **(paired by reading)** | islamhouse-2831443 s7 [14] | byenah-4784 s19 [17] | 2.3 c4 | invalidator 1: what comes out of the two passages, with examples |
| `mukhtasar` **(paired by reading)** | islamhouse-2831443 s7 [14] | byenah-4784 s19 [18] | 2.3 c5 | invalidator 2: loss of mind through deep sleep, fainting, intoxication, insanity |
| `mukhtasar` **(paired by reading)** | islamhouse-2831443 s7 [4] | byenah-4784 s18 [13] | 2.4 c3 | the intention: its place is the heart, and its meaning |
| `mukhtasar` **(paired by reading)** | islamhouse-2831443 s7 [5] | byenah-4784 s18 [14] | 2.4 steps.2 | washing the hands (to the wrists) |
| `mukhtasar` **(paired by reading)** | islamhouse-2831443 s7 [6] | byenah-4784 s18 [16] | 2.4 steps.3 | definition of rinsing the mouth |
| `mukhtasar` **(paired by reading)** | islamhouse-2831443 s7 [7] | byenah-4784 s18 [18] | 2.4 steps.4 | definition of istinshaq |
| `mukhtasar` **(paired by reading)** | islamhouse-2831443 s7 [10] | byenah-4784 s19 [8] | 2.4 steps.6 | hands washed from the fingertips to the elbows |
| `mukhtasar` **(paired by reading)** | islamhouse-2831443 s7 [12] | byenah-4784 s19 [11] | 2.4 steps.7 | head wiped from the front to the nape and back |
| `mukhtasar` **(paired by reading)** | islamhouse-2831443 s7 [13] | byenah-4784 s19 [14] | 2.4 steps.9 | feet washed from the toes to the ankles, ankles included |
| `mukhtasar` **(paired by reading)** | islamhouse-2831443 s9 [2] | byenah-4784 s21 [3] | 2.5 c3 | ghusl: water over the whole body incl. mouth and nose removes the major hadath |
| `mukhtasar` **(paired by reading)** | islamhouse-2831443 s10 [2] | byenah-4784 s22 [2] | 2.5 c7 | tayammum: one strike, then wipe the face and hands |
| `ibnbaz-lessons` | 1871 t10 [1] | 2842316 s9 [2] | 3.2 c1 | the nine conditions of prayer (list without the 'they are nine' lead-in) |
| `mukhtasar` **(paired by reading)** | islamhouse-2831443 s11 [4] | byenah-4784 s23 [11] | 3.4 c1 | step 1: the intention for the prayer, made in the heart |
| `ibnbaz-prayer` | 62675 t6 [1] | 1261 a1-page-15 [1] | 3.4 c3 | in prostration the worshipper supplicates much (ar «ويكثر من الدعاء» / en 'exceed more and more in supplications and ask for more from his Lord') |
| `mukhtasar` **(paired by reading)** | islamhouse-2831443 s11 [9] | byenah-4784 s23 [17] | 3.4 steps.qiraah | after al-Fatihah, recite from the Qur'an in the first and second rak'ah only (ar excerpt stops at «فقط», before the damaged «صاة») |
| `ibnbaz-prayer` | 62675 t5 [1] | 1261 a1-page-11 [1] | 3.4 steps.ruku | head level with the back, hands on the knees with fingers spread, tranquility in bowing |
| `ibnbaz-prayer` | 62675 t6 [1] | 1261 a1-page-14 [1] | 3.4 steps.sujud1 | prostration on the seven parts: forehead with nose, hands, knees, toes |
| `ibnbaz-lessons` | 1871 t14 [10] | 2842316 s13 [10] | 3.4 steps.jalsa | sitting on the left foot with the right foot upright, in the first tashahhud and between the two prostrations |
| `ibnbaz-prayer` | 62675 t7 [3] | 1261 a1-page-17 [1] | 3.4 afterRakah.second | rise for the second rak'ah (on the knees, or the ground if hard), recite al-Fatihah and more, do as in the first |
| `ibnbaz-lessons` | 1871 t11 [1] | 2842316 s10 [2] | 3.5 c1 | the fourteen pillars of prayer (Lesson Seven), including reciting al-Fatihah |
| `ibnbaz-lessons` | 1871 t11 [1] | 2842316 s10 [2] | 3.6 c1 | the fourteen pillars of prayer (Lesson Seven) |
| `ibnbaz-lessons` | 1871 t12 [1] | 2842316 s11 [2] | 3.6 c2 | the eight obligatory acts of prayer (Lesson Eight) |
| `ibnbaz-lessons` | 1871 t15 [2] | 2842316 s14 [2] | 3.6 c5 | first invalidator: intentional talking; not for the forgetful or unaware (Lesson Eleven) |
| `ibnbaz-lessons` | 1871 t14 [15] | 2842316 s13 [15] | 3.8 c6 | audible recitation in Fajr, Jumu'ah, Eid, Istisqa and the first two rak'ahs of Maghrib and Isha (Lesson Ten, sunnah acts) |

## Hadiths

Every hadith is shown by its HadeethEnc id in Arabic and English, with grade, attribution and the date it was fetched. Hadith wording that had been typed into card text was either confirmed on HadeethEnc and cited by id (the typed sentence removed), or removed with the sentence that depended on it.

| Lesson | Card | Words | HadeethEnc id | Result | Note |
|---|---|---|---|---|---|
| 1.2 | c2 | من قالها صادقًا ... نجا من النار | 10098 | cited | Arabic and English fetched; both say whoever testifies sincerely from the heart is made forbidden to the Fire. See review for the phrase 'seeking Allah's pleasure'. |
| 1.2 | c3 | من مات وهو مؤمن بها دخل الجنة | 65008 | cited | Arabic and English fetched: 'Whoever dies while not associating anything with Allah will enter Paradise'. |
| 1.3 | c6 | لا يُزاد في العبادات ما لم يشرعه النبي | 66514 | cited | Arabic and English fetched: 'Whoever introduces something into this matter of ours that is not part of it will have it rejected'. |
| 1.4 | c1 | الإسلام مبني على خمسة أركان | 66512 | cited | Arabic and English fetched; both list the five. |
| 1.4 | c4 | الصلاة عمود الدين | 4303 | cited | Arabic «وعموده الصلاة» and English 'its pillar is the prayer' both confirmed. |
| 1.5 | c1 | حديث جبريل عن الإيمان | 4563 | cited | Arabic and English fetched. |
| 1.6 | c3 | التوبة | 5344 | cited | Arabic and English fetched; the hadith is about repenting but does not contain the card's conditions (see review). |
| 1.6 | c6 | حلاوة الإيمان | 65115 | removed | Arabic only: the English API response is empty, and the catalogue lists no English translation. The whole card paraphrased this hadith, so the card was removed. The Mukhtasar's own 'taste of faith' hadith (s14 [5] / s25 [6]) is a different hadith, and its Arabic is damaged. |
| 2.2 | c6 | غفرانك | 10046 | removed | 10046 confirmed in ar and en (Abu Dawud, at-Tirmidhi, Ibn Majah, Ahmad; authentic). The card was a single sentence holding the typed wording, so deleting that sentence emptied the card: c6 removed, and its evidence 3150 with it. A toilet-etiquette card can cite 10046 / 3150 once a book source for its text exists. |
| 3.1 | c5 | الصلاة نور | 65004 | removed | Confirmed in ar and en on HadeethEnc, but the card already has evidence 29:45, which its remaining sentence and its check depend on; the typed sentence «والصلاة نور،» / "Prayer is a light." was deleted and the select item 'It is a light' removed. 65004 is free to cite if the team wants the 'light' virtue back as an evidence-led card. |
| 3.1 | c6 | أول ما يُحاسب عليه | 65424 | removed | HadeethEnc has 65424 «إن أول ما يحاسب به العبد الصلاة» in Arabic only (no English translation), so it cannot be confirmed in both languages; card c6 and the select item 'The first thing one is asked about' removed. |
| 3.1 | c7 | راحة / إذا أهمّه أمر | 65095 | cited | 65095 ('O Bilal, call the iqamah; give us comfort by it') supports 'prayer was his comfort'; it does not contain 'whenever something troubled him he turned to it', so that sentence was removed and the situation built on it set to null. |
| 3.2 | c6 | من نام عن صلاة | None | removed | No HadeethEnc hadith with the sleeping wording found (searched categories 3, 4, 5, 121, 133, 134). 65088 «من نسي صلاة فليصل إذا ذكرها» (ar+en, agreed upon) covers forgetting only; card removed, as deleting the sentence leaves it empty. |
| 3.3 | c2-c6 | (prayer times, no typed wording) | 10596 | cited | Added as evidence to the five time cards; ar and en both state the times of Dhuhr, Asr, Maghrib, Isha and Fajr (Muslim). |
| 3.4 | c2 | سنن أبي داود 61؛ سنن الترمذي 3 | 5216 | cited | The hadith of that citation («مفتاح الصلاة الطهور...») is not on HadeethEnc (searched categories 3, 4, 5, 121, 133, 134). Evidence changed to 5216 (Muslim, from Aisha): 'used to start the prayer with the Takbir ... used to conclude the prayer with the Taslim', confirmed in ar and en, which is exactly the card's point. |
| 3.4 | c3 | أقرب ما يكون العبد من ربه | 5382 | cited | Typed hadith wording removed: the card text is replaced by Ibn Baz's verbatim 'supplicate much' (textRef); evidence 5382 kept. |
| 3.7 | c1 | صلاة الجماعة تفضل صلاة المنفرد بسبع وعشرين درجة | 3441 | cited | already the card's evidence; ar and en confirmed (27 degrees; متفق عليه / Narrated by Bukhari & Muslim); typed sentence deleted, card is now evidence-only |
| 3.7 | c2 | وكلما كثر العدد كان أحب إلى الله | None | removed | no HadeethEnc catalogue entry; card had no evidence |
| 3.7 | c3 | None | 6029 | cited | existing evidence kept; ar and en confirmed (the imam is to be followed: bow when he bows) |
| 3.8 | c2 | الجمعة خير يوم طلعت عليه الشمس | 3711 | cited | already the card's evidence; ar and en confirmed (رواه مسلم / Narrated by Muslim); typed sentence deleted, card is now evidence-only |
| 3.8 | c5 | None | 5433 | cited | evidence added (card had none); ar and en confirmed: listens attentively, keeps silent, touching a pebble is idle activity (رواه مسلم / Narrated by Muslim) |
| 3.6 | c6 | None | 10878 | cited | existing evidence kept; ar and en confirmed (looking around in prayer); it supports the first of the three disliked acts the team text lists |
| 3.6 | c4 | ومن شكّ في عدد الركعات بنى على الأقل | None | removed | card had no evidence and no book passage |

## Terms missing from the stored terminology

No definition was written. These terms are used in lessons but are not in `content/corpus/terms/`:

- 1.3: Sunnah (السنة), card c5 'follow his Sunnah' (TerminologyEnc id not found)
- 1.4: zakah (الزكاة), activity a1 'Paying zakah' (TerminologyEnc id not found)
- station 1 (stored, can be pointed to): توحيد 10482 (1.2 c4, 1.5 c5); عبادة 15008 (1.2); الإيمان 46045 (1.5); توبة 36599 (1.6); وضوء 6733 (1.4 a1 distractor), all in content/corpus/terms/ (TerminologyEnc id not found)
- 2.1: shirk (شرك) (TerminologyEnc id 4062)

## Activities and items removed

| Lesson | Activity | Why |
|---|---|---|
| 1.1 | a1 | select 'how to show gratitude for Islam' was built from the removed card c5 |
| 1.4 | a2 | order 'faith, purification, prayer' was built from the removed card c5 |
| 1.4 | situation | 'why learn purification before prayer' was built from the removed card c5; set to null |
| 1.5 | situation | 'which pillar reminds you everything happens by Allah's knowledge and will' was built from the removed card c7; set to null |
| 2.1 | a2 | sort required/recommended drawn from removed card c4 (mushaf/tawaf disputed) |
| 2.2 | a1 | swipe items drawn from removed cards c2, c4; the two remaining items (dead fish, insects) come from no card |
| 2.2 | a2 | order drawn from removed cards c6, c7 |
| 2.3 | a2 | match minor/major drawn from removed card c2 |
| 2.1 | a1: Wudu (outward) | drawn from removed cards |
| 2.3 | a1: made wudu, prayed Dhuhr, Asr came | drawn from removed card c3 |
| 2.5 | a1: I cannot use water -> Tayammum | drawn from removed card c6 |
| 3.1 | a1 (items only) | items 'It is a light' (deleted hadith sentence) and 'The first thing one is asked about' (removed card c6) removed; 3 items remain, activity kept |
| 3.2 | a2 (steps only) | the passageway and distraction steps came from removed card c8; one step remains, activity kept |
| 3.7 | a1 | late-arrival cases drawn from removed cards c5-c7 and listed as disputed; no book states the case |
| 3.7 | a2 | drawn from removed card c4 (a single follower stands to the imam's right) |
| 3.8 | a1 | order items drawn from removed card c4 (bath, clothes, going early) and from c6's 'two rak'ahs', no longer stated; only one item would remain |

## Missing content: objectives no card covers any more

These need approved text in both languages, or the objective should be removed:

- 2.1: meaning of taharah; purification before prayer; when wudu is required or recommended; najasah vs hadath
- 2.2: definition of najasah, default purity, list of impure things, removing impurity, toilet etiquette, istinja/istijmar
- 2.3: definition of hadath, minor vs major, one wudu for several prayers
- 2.5: menstruation (no prayer or fasting, making up fasts), best manner of ghusl, wiping over socks, when tayammum is allowed
- 3.5: an approved text, in both languages, on the virtue of al-Fatihah and on saying Ameen.
- 3.6: the prostration of forgetfulness and doubt about the number of rak'ahs; a definition of recommended acts; Ibn Baz's other seven invalidators need a multi-paragraph textRef or separate cards.
- 3.7: any approved-book text on congregation: forming rows, where a single follower stands, what a latecomer does (the stored 62675 Arabic stops after the sitting for tashahhud; 1261 OCR is not clean).
- 3.8: who must attend the Friday prayer, its etiquette (bath, clothes, going early), the two sermons, and what to do if it is missed.

## Open points for the reviewer

- 1.2 c2 (team): the card says "seeking Allah's pleasure"; its hadith 10098 says "sincerely from his heart".
- 1.6 c3 and activity a1: the three conditions of repentance are not in the card's hadith 5344, and no approved book states them.
- 1.3 a1 (timeline): the seerah dates and ages are team-written with no cited source.
- 2.2 c5 (team): says a remaining smell does no harm; hadith 8373 mentions only the mark.
- 2.4 step 2: the "three times" label on washing the hands is team metadata with no book behind it.
- 2.5 a2: says "backs of the hands" while the book text now shown says "face and palms".
- 3.1 c2 now opens with «وهي», which pointed back to the removed c1.
- 3.3: the rak'ah counts and the prayer times in the `prayers` list are team-written; c4 says 'Asr lasts until sunset, while its hadith 10596 says until the sun turns yellow.
- 3.4: the intention card no longer says not to pronounce the intention; Ibn Baz states it, but the English edition (1261) is OCR-damaged there.
- 3.8 c5: given hadith 5433 as evidence (confirmed in both languages) in place of no evidence; its unsupported "two sermons" sentence was removed.

## Sources

- Every link to the unapproved lesson website, and every reference to it as a source, was removed from lessons, `content/sources.json` and the docs. A test fails if its name appears anywhere under `content/`, `web/` or `docs/`.
- IslamHouse 2838873/2838874 (Haitham Sarhan's guide) is not used and no longer listed.
- Suggested videos: Zadi and Guide To Islam were removed; Osoul Center's two IslamHouse videos remain, with the IslamHouse page as the primary link.
