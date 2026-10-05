# Sources

Every source Rehla uses. Generated from `content/sources.json` by `npm run content:sources` (in `web/`); edit that file, not this one. The same data is shown to learners at `/[locale]/sources`.

## Quran

| Source | Link | Used for | Licence | Status | Checked on |
| --- | --- | --- | --- | --- | --- |
| QuranEnc.com (`quranenc`) | <https://quranenc.com> | The Quran verses cited by lesson cards and the verses of the "Ayah by ayah" activity, fetched by reference and never typed. Each verse is shown in Arabic, with the Noor International Center translation (english_saheeh) in the English interface. Rafiq shows every verse in Arabic with one published translation in the answer's language, with its name and version: english_saheeh (English Translation - Noor International Center, 1.1.2), urdu_junagarhi (Urdu Translation - Muhammad Junagarhi, 1.1.3) and french_montada (French translation - Noor International Center, 1.0.0), chosen with list_quran_translations on 2026-10-04. QuranEnc lists no Bengali translation, so a verse in a Bengali answer shows the English one, labelled as such. In Mawqif, words of two verses (2:156, 4:86) are quoted exactly, and the whole verse is shown on request. | QuranEnc.com's published terms (its About and Developers' pages, checked on 2026-10-04): Contents of the translations can be downloaded and re-published, with the following terms and conditions: 1. No modification, addition, or deletion of the content. 2. Clearly referring to the publisher and the source (QuranEnc.com). 3. Mentioning the version number when re-publishing the translation. 4. Keeping the transcript information inside the document. 5. Notifying the source (QuranEnc.com) of any note on the translation. 6. Updating the translation according to the latest version issued from the source (QuranEnc.com). 7. Inappropriate advertisements must not be included when displaying translations of the meanings of the Noble Quran. Rehla shows the texts unmodified, names each translation and its version under the verse (or says that QuranEnc publishes no version number for it), and carries no advertisements. | Approved | 2026-10-04 |
| mp3quran.net (`mp3quran`) | <https://mp3quran.net> | Recitation audio in the "Ayah by ayah" activity, with each ayah's timing from the source's API. The surah names that label the verses Rafiq shows, in Arabic, English, Urdu, Bengali and French (content/fetched/surahs.json). | Audio is streamed from the source's servers and not re-hosted. | Approved | 2026-10-04 |

## Hadith

| Source | Link | Used for | Licence | Status | Checked on |
| --- | --- | --- | --- | --- | --- |
| HadeethEnc.com (`hadeethenc`) | <https://hadeethenc.com> | The hadiths cited by lesson cards, with their grade, attribution and explanation, fetched verbatim by ID. A hadith is shown in the learner's language when the source has a version in it; otherwise only its reference is given. Rafiq's corpus also keeps a catalogue of hadith and category titles only, without texts. Rafiq shows a hadith in Arabic with its published translation in the answer's language (Arabic, English, Urdu, Bengali or French) and, in Urdu, Bengali and French answers, HadeethEnc's own explanation; a hadith with no version in that language is shown with its English one, labelled as such. In Mawqif, each situation's words, reasons and times are quoted exactly from hadiths, with their attribution and grade, and the whole hadith is shown on request. | HadeethEnc.com publishes no reuse conditions beyond its About page (checked on 2026-10-04), which says it provides its translations "for free through all available means". The organisers' package states that the content of the Association's platforms is free for individuals and organisations; text is kept unmodified and attributed, and each hadith is shown with its grade, attribution, link and the date it was fetched. | Approved | 2026-10-04 |

## Lessons

| Source | Link | Used for | Licence | Status | Checked on |
| --- | --- | --- | --- | --- | --- |
| Al-Durus al-Muhimmah li-'Ammat al-Ummah (Arabic), Abdul Aziz bin Baz (`ih-durus-muhimmah`) | <https://islamhouse.com/ar/books/1871/> | Reference text for the team writing the Khutuwat lessons: the Arabic book, kept word for word as published, section by section. Lesson cards quote it verbatim by reference (book, section, paragraph and an exact excerpt, checked by a test). In Mawqif, phrases of its lesson on Islamic manners are quoted exactly. | The organisers' package states that the content of the Association's platforms is free for individuals and organisations; text is kept unmodified and attributed. Publisher: Sheikh Abdulaziz bin Baz Charitable Foundation. Non-profit use only. | Approved | 2026-10-04 |
| The Important Lessons for the General Ummah, Abdul Aziz bin Baz (risala.prh.gov.sa) (`risala-important-lessons`) | <https://islamhouse.com/en/books/2842316/> | Reference text for the team writing the Khutuwat lessons: the English translation as extracted from its PDF, lesson by lesson. Arabic quotations in the PDF do not extract in letter order and are not used. Lesson cards quote it verbatim by reference (book, section, paragraph and an exact excerpt, checked by a test). In Mawqif, phrases of its lesson on Islamic manners are quoted exactly. | The organisers' package states that the content of the Association's platforms is free for individuals and organisations; text is kept unmodified and attributed. Translation published by risala.prh.gov.sa. Non-profit use only. | Approved | 2026-10-04 |
| The Prophet's Manner of Performing Prayer, Abdul Aziz bin Baz (`ih-salat-nabi`) | <https://islamhouse.com/ar/books/62675/><br><https://islamhouse.com/en/books/1261/> | Reference text for the team writing the prayer lessons: the Arabic book kept word for word, section by section, and the English edition's text page by page. Lesson cards quote it verbatim by reference (book, section, paragraph and an exact excerpt, checked by a test). | The organisers' package states that the content of the Association's platforms is free for individuals and organisations; text is kept unmodified and attributed. Non-profit use only. | Approved | 2026-10-04 |
| How to Make Wudū’ (Ablution): An Illustrated Explanation, Osoul Center (`osoul-wudu-guide`) | <https://islamhouse.com/en/books/2839339/> | Illustrations for the wudu lessons, taken from the guide without cropping or changes and credited to Osoul Center. | The organisers' package states that the content of the Association's platforms is free for individuals and organisations; text is kept unmodified and attributed. Credit: Osoul Center via IslamHouse.com. Non-profit use only. | Approved | 2026-10-04 |
| New Muslim Guideline, Muhammad al-Shehri (byenah.com) (`byenah-new-muslim-guideline`) | <https://byenah.com/en/muslim-content/4784> | Reference text for Rafiq's answers (English): the book as published, section by section, kept in Rafiq's corpus. Lesson cards quote it verbatim by reference (book, section, paragraph and an exact excerpt, checked by a test). In Mawqif, its definition of fasting Ramadan is quoted exactly. | The organisers' package states that the content of the Association's platforms is free for individuals and organisations; text is kept unmodified and attributed. | Approved | 2026-10-04 |
| Al-Mukhtasar al-Mufid lil-Muslim al-Jadid (Arabic), Muhammad al-Shehri (`ih-almukhtasar-almufid`) | <https://islamhouse.com/ar/books/2831443/> | Reference text for Rafiq's answers (Arabic): the book as published, section by section, kept in Rafiq's corpus. Its verses are set in a glyph font that does not extract as text, so verses are taken from their own source. Lesson cards quote it verbatim by reference (book, section, paragraph and an exact excerpt, checked by a test). In Mawqif, its definition of fasting Ramadan is quoted exactly. | The organisers' package states that the content of the Association's platforms is free for individuals and organisations; text is kept unmodified and attributed. Non-profit use only. | Approved | 2026-10-04 |

## Video

| Source | Link | Used for | Licence | Status | Checked on |
| --- | --- | --- | --- | --- | --- |
| Osoul Center videos on IslamHouse.com (`islamhouse-videos`) | <https://islamhouse.com/ar/videos/2834583/><br><https://islamhouse.com/en/videos/2834586/><br><https://islamhouse.com/ar/videos/2832089/><br><https://islamhouse.com/en/videos/2838921/> | The suggested video of the wudu lesson (How do I perform wudu?) and of the prayer lesson (How do I pray?): the video's IslamHouse page is the primary link, and the file plays from the site's own servers, never re-uploaded. | The organisers' package states that the content of the Association's platforms is free for individuals and organisations; shown unmodified and attributed. Credit: Osoul Center's scientific team via IslamHouse.com. Non-profit use only. | Approved | 2026-10-04 |

## Terminology

| Source | Link | Used for | Licence | Status | Checked on |
| --- | --- | --- | --- | --- | --- |
| Encyclopedia of Translated Islamic Terms (TerminologyEnc.com) (`terminologyenc`) | <https://terminologyenc.com> | The definitions of nine terms in Arabic and English, kept as published in Rafiq's corpus, each with the link to its page. | The organisers' package states that the content of the Association's platforms is free for individuals and organisations; text is kept unmodified and attributed. | Approved | 2026-10-04 |

## Referral

| Source | Link | Used for | Licence | Status | Checked on |
| --- | --- | --- | --- | --- | --- |
| Directory of the National Center for Non-Profit Sector (`ncnp-directory`) | In this repository | The licensed bodies Rafiq refers to and the "Talk to a specialist" page lists: one national channel (the 1933 unified call centre) and 13 associations in seven Saudi cities. Collected by the team lead on 2026-10-04, verified fields only, shown as given. | Public contact details published in the directory, shown unmodified. Rehla shares nothing about the learner with these bodies. | Approved | 2026-10-04 |

## Illustrations

| Source | Link | Used for | Licence | Status | Checked on |
| --- | --- | --- | --- | --- | --- |
| Rehla team illustrations (`rehla-art`) | In this repository | The drawings pinned on each lesson's board, the icons, and Rafiq's character. The scene drawings and icons were produced with the help of an AI tool and reviewed by the team. Rafiq's character was generated with an image tool from the team's brief. | Produced for the Rehla project with AI tools, from the team's brief and under its review. | Approved | 2026-10-04 |

## Live retrieval (nothing stored)

| Source | Link | Used for | Licence | Status | Checked on |
| --- | --- | --- | --- | --- | --- |
| MCP server of the Association for Multilingual Islamic Content (`islamiccontent-mcp`) | <https://mcp.islamiccontent.org/mcp> | Live retrieval, nothing stored: Rafiq reads verse and hadith texts from it at the time of the question, with their links. It was used to find the hadiths of the Mawqif situations before they were fetched from HadeethEnc (scripts/sources/mawqif-search.mjs). | What is retrieved is shown with its text and link exactly as returned, and is not stored. | Approved | 2026-10-04 |

## Further reading (links only)

| Source | Link | Used for | Licence | Status | Checked on |
| --- | --- | --- | --- | --- | --- |
| Dorar.net (`dorar`) | <https://dorar.net> | Links only ("read more"): Rafiq may point the learner to it; no text is copied or quoted. Approved as a link. | Nothing is copied from it; it is only linked. | Approved | 2026-10-04 |
| IslamQA.info (`islamqa`) | <https://islamqa.info> | Links only ("read more"): Rafiq may point the learner to it; no text is copied or quoted. Approved as a link. | Nothing is copied from it; it is only linked. | Approved | 2026-10-04 |
| Official site of Sheikh Abdulaziz bin Baz (`binbaz`) | <https://binbaz.org.sa> | Links only ("read more"): Rafiq may point the learner to it; no text is copied or quoted. Approved as a link. | Nothing is copied from it; it is only linked. | Approved | 2026-10-04 |
| Official site of Sheikh Muhammad ibn Salih al-Uthaymeen (`binothaimeen`) | <https://binothaimeen.net> | Links only ("read more"): Rafiq may point the learner to it; no text is copied or quoted. Approved as a link. | Nothing is copied from it; it is only linked. | Approved | 2026-10-04 |
| Tafsir Center for Quranic Studies (tafsir.net) (`tafsir-net`) | <https://tafsir.net> | Links only ("read more"): Rafiq may point the learner to it; no text is copied or quoted. Approved as a link. | Nothing is copied from it; it is only linked. | Approved | 2026-10-04 |

## Media in lessons

No images or videos have been added to lessons yet.
