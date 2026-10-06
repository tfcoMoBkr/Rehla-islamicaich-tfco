# Operations

What it costs to run Rehla, what it depends on and what happens when a dependency fails, how its content is reviewed, and what comes next.

## Cost per question

Measured on the committee run of 6 October 2026 (`eval/results/2026-10-05-committee.json`): 56 questions through Rafiq on the production models, every OpenRouter call counted from the provider's own token report and priced at OpenRouter's published prices on that day.

| Measure | Value |
|---|---|
| Model calls per question | 5.2 on average (9 at most): classify, generate, the support check, and on some questions a retry, a widened search or an everyday line |
| Tokens per question | 9,498 prompt and 663 completion, on average |
| Cost per question (Rafiq's model calls) | **$0.00121** on average, $0.00127 median, $0.00271 at most |
| By kind of question | everyday talk $0.00059; official questions $0.00135; Urdu, Bengali and French $0.00114; the reviewer's questions $0.00161 |
| Calls to the Association's content server (MCP) | 3.6 per question on average, free |
| Time to answer | 10.3 s median, 20.9 s at the 90th percentile, 35.1 s at most (the budget is 45 s) |

Prices used (per million tokens, input / output): `google/gemini-2.5-flash-lite` $0.10 / $0.40; `google/gemma-4-31b-it` (fallback) $0.09 / $0.34; `baai/bge-m3` (embeddings) $0.01. 206 of the run's model calls went to the main model and 2 to the fallback. The embedding calls (85) are counted, but the provider reports that model under other names (`BAAI/bge-m3`, `parasail-bge-m3`), so the run priced them at zero; at $0.01 per million tokens, a question's embedding costs about $0.000001.

The judge used for the evaluation (`openai/gpt-6-luna`) is not part of the product and is not in these figures.

Not measured: Lens (one vision call per photo, plus a call per turn that looks at it again) and Mawqif practice (one call to set a scene, one per reply, one for the feedback). Each of those calls is smaller than a Rafiq answer, but no run has measured them.

## A month at three levels of use

Rafiq's model calls only, at the measured average of $0.00121 a question:

| Use | Questions a month | Model cost a month |
|---|---|---|
| A pilot: 100 questions a day | 3,000 | about $3.60 |
| An association's learners: 1,000 a day | 30,000 | about $36 |
| A national service: 10,000 a day | 300,000 | about $363 |

At the third level, `DAILY_QUESTION_CAP` (default 1,500 a day, counted per instance) would have to be raised. Hosting is extra and not measured here: both projects run on Vercel, and accounts and the community on Supabase; both have free plans that fit a pilot, and paid plans at their published prices beyond it. The content server, the approved sites and the evaluation judge cost nothing to run the product.

## External dependencies

| Dependency | What Rehla uses it for | When it fails |
|---|---|---|
| OpenRouter, main model (`LLM_MODEL`) | Rafiq, Mawqif scenes and feedback, Lens's questions | The fallback model answers. A model that answers 429 rests for 60 s. |
| OpenRouter, fallback model | The same, when the main one fails | With both down, Rafiq shows "cannot be reached right now"; Mawqif falls back to the written replies; nothing else on the site is affected. |
| OpenRouter, embeddings (`EMBEDDING_MODEL`) | Searching the local index by meaning | Search continues by keywords (BM25) alone; answers may be weaker, never unsourced. |
| OpenRouter, vision model (`VLM_MODEL`) | Lens: reading a photo, and looking again in a conversation | Lens shows its "unavailable" card; Rafiq and the rest work. |
| `mcp.islamiccontent.org` (the Association's content server) | Verses and hadiths in the answer's language, the approved sources' own search, quoted texts looked up | Rafiq answers from the local index. Urdu, Bengali and French answers, which need texts published in that language, are referred. A quoted verse or hadith cannot be looked up, and is reported as not found in the approved sources (a known limit: the card does not yet say the server was down). |
| Vercel | Hosting both projects | The site is down; nothing is lost, since nothing is stored there. |
| Supabase | Optional accounts and the community | Learners continue as guests with their progress on the device; the community pages say "not available here". |
| mp3quran.net | Recitation audio in the "Ayah by ayah" activity | The audio does not play; the verse text and its translation stay. |
| IslamHouse.com | The suggested videos at the end of two lessons (played from its servers) | The video does not load; the lesson is complete without it. |
| quranenc.com, hadeethenc.com, terminologyenc.com, islamhouse.com, byenah.com, dawa.center | Fetched by the content scripts on a developer's machine only | No effect on the running product: what the product shows is stored in the repository (`content/fetched/`) or the committed index. |

## Content review

Who does what today, and what is proposed.

- **The team (Thakaa Flow)** builds the content only from the approved sources, by script, and never writes religious text: lesson cards point to stored book text by reference, verses and hadiths are stored by ID, and everything else is labelled as the team's wording. Every change made during the October audit is listed for a reviewer in `docs/CONTENT_REVIEW.md`; Mawqif's sources are in `docs/MAWQIF_COVERAGE.md`; every source and its licence in `docs/SOURCES.md`.
- **Scholarly review has not been done.** Every lesson file says so (`reviewed: false`, `reviewedBy` empty), and the product claims no review. Proposed: a qualified reviewer named by the organisers or by the Association reads `docs/CONTENT_REVIEW.md` lesson by lesson; each lesson approved gets `reviewed: true` and the reviewer's name, and the lesson page can then show it.
- **Native review of Urdu, Bengali and French.** The fixed lines Rafiq shows in those languages are in `web/messages/answer-languages.json`; `_changedForReview` lists the lines still to check. Proposed: one native speaker per language, from the Association's translation partners.
- **Sources pending review.** «بينات» (dawa.center) is marked "pending review" on the sources page: its page publishes no reuse licence. The team needs the publisher's (Osoul Center's) confirmation before it is relied on in production.
- **Rafiq's answers** are checked by code on every answer (`docs/RELIABILITY.md`) and measured by the committee run (`docs/EVALUATION.md`). Proposed: the team re-runs the committee set after every change to a prompt, a check or the corpus, and a reviewer reads the failures.

## Next steps

1. Scholarly review of the 19 lessons and the 12 Mawqif situations, then the review status shown in the product.
2. Raise the committee pass rate where the run shows the most failures: answers that read as lectures rather than a companion's words, and questions answered with nearby rather than exact content.
3. The publisher's confirmation for «بينات», and an English edition if one exists.
4. Measure Lens and Mawqif per-turn costs the way Rafiq's were measured.
5. Tell the learner when the content server is down, rather than reporting a quoted text as not found.
6. A study with real learners of the understanding measure (`docs/UNDERSTANDING.md`), with their consent; until then no learner results are reported.
7. Aqim (practice prayer with the camera): proposed, not built; the section is hidden and is not in the live version.
8. A book that states the obligatory rak'ah count of each prayer (for example IslamHouse «Salah (Prayers) Step by Step», which needs `ISLAMHOUSE_API_KEY` to fetch): until then Rafiq answers that question with the honest no-source card and links to lessons 3.3 and 3.4.
9. Re-extract «بينات» and the other PDF books in reading order, so their passages can be quoted again; until then they are cited by their source card only.
