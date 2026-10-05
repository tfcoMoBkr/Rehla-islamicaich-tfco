# content/

Data, not code. Everything a learner reads in Khutuwat comes from these files, in both languages. The app validates every file when it loads it (`web/src/lib/content/schema.ts`); an invalid file stops it with the file name and the field at fault.

```
lessons/<id>-<slug>.json         Lessons, written by the team. They define the lesson format; the engine renders them as they are.
lessons/practice/*.json           The practice lesson: neutral, non-religious sample content that shows how the engine works.
stations/<id>.json                A station: title, order, "what do I know?" and exam questions. Its lessons are those whose "station" matches.
evidence/station-<n>.json         The team's evidence research per station (references only).
fetched/                          Verses, hadiths, recitation timings and source books, saved verbatim by scripts/fetch-content.mjs. Never edited by hand.
media/                            Lesson images, each listed in media/manifest.json with its credit, source and licence (one folder deep at most).
sources/                          Source PDFs downloaded by scripts/fetch-content.mjs. Git-ignored; re-downloaded when missing.
referral-centers.json             Verified people and centres for the "Talk to a human" page. Empty until each contact is checked.
sources.json                      Every source the product uses (rendered at /sources; docs/SOURCES.md is generated from it).
```

## How lessons appear

- Every lesson with `"status": "published"` (and every demo lesson) is shown. Its text is taken verbatim from the approved sources it names, or is marked as the team's wording, and was checked by the team. `reviewed` and `reviewedBy` claim no scholarly review: they stay `false` and empty.
- The lesson URL is `/<locale>/learn/<station>/<slug>`.
- Every source a lesson names (`sources[].url`, video `channel`) must belong to a source in `sources.json`; otherwise the engine reports it and does not show it.

## Evidence

Cards cite Quran verses and hadiths by reference. Run this from the repository root after adding or changing references:

```bash
node scripts/fetch-content.mjs            # fetch what is missing
node scripts/fetch-content.mjs --refresh  # fetch everything again
```

It saves each verse (quranenc.com: Arabic text and the `english_saheeh` translation with its version), each hadith in every language listed in `availableIn` (hadeethenc.com: text, grade, attribution, explanation), and the ayah timings of every surah cited, so each verse can be heard in its real recitation (mp3quran.net), each with its source URL and fetch date. A hadith with no `hadeethencId`, or with no version in the learner's language, is shown as its citation only.

## Source books

The same script fetches the books the lessons are written from, through the IslamHouse API. Set `ISLAMHOUSE_API_KEY` in the environment or in a `.env` file at the repository root; without it the books are skipped. Requests go one at a time, since the API refuses bursts. Reading PDFs needs [uv](https://docs.astral.sh/uv/) (`scripts/pdf_tools.py`).

- **Arabic books** (IslamHouse items 1871 and 62675) come as HTML. Each anchored heading (`t1`, `t2`, …) becomes `fetched/books/<id>/<anchor>.json`: `heading`, `paragraphs[]` (`index`, the HTML paragraph `id`, `text`, and `notes` when it cites footnotes), `footnotes`, and `source` (URL, fetch date). Tags are removed and whitespace collapsed as a browser shows it; no character is changed.
- **English books** (2842316 and 1261) are PDF only. The PDF is kept in `sources/`, and its text is split at the headings its own table of contents lists (`s1`, `s2`, …), each heading checked on the page the table names. Paragraphs carry the `pages` they come from; footnotes printed on those pages are kept apart. If any heading cannot be found exactly, the book is saved page by page (`page-NN`) instead and the unmatched headings are listed in its index. A paragraph marked `arabicFromPdf` holds Arabic whose letter order the PDF does not preserve: take any verse or hadith from its own source, never from these files.
- **The illustrated wudu guide** (2839339) gives its pictures to `media/wudu-guide/`, unaltered (JPEGs byte for byte, others as lossless PNG with their transparency), each listed in `media/manifest.json` with its credit and licence. Slivers and repeated images are skipped.

Each book's `index.json` lists its sections with their paragraph counts and how its text was taken.

## Rafiq's corpus

`node scripts/fetch-content.mjs --corpus` builds `corpus/` (git-ignored), one module per source in `scripts/sources/`. Requests go one at a time with pauses, back off on 429, and every step resumes from what is already saved (API pages are cached in `corpus/.cache/`). Every record keeps its text verbatim with its source name, public URL, language and fetch date. Quran and hadith texts are not stored: Rafiq reads them live from the MCP server (`docs/MCP_TOOLS.md`, from `--mcp-probe`).

- `corpus/books/<id>/<n>.json` + `index.json`: books split at their own headings, in the same shape as `fetched/books/`. A DOCX is split at its heading styles (python-docx); a PDF at the chapters its contents pages link to. A PDF with no text layer is reported and nothing is saved (no OCR).
- `corpus/books/pairs/<book>.json`: the Arabic and English editions of a book paired section by section only where both editions show it (same lesson number, or same number of sections in order); the rest is listed as unpaired.
- `corpus/hadith-catalogue.json`: the HadeethEnc category tree and the titles (no texts) of the hadiths in the chosen categories, in Arabic and English; hadiths with no English title are marked.
- `corpus/terms/<id>.json`: chosen TerminologyEnc term pages, each field in Arabic and English.
- `corpus/index.json` lists every book, including the lesson books in `fetched/books/` (indexed where they are); `corpus/MANIFEST.json` gives counts, characters per language, failures and notes per source; `docs/COVERAGE.md` shows which sections and categories cover each lesson.

## Stations and questions

Station files hold the scored questions: `baseline` ("what do I know?") and `exam`, on the **same objectives**, so the journal can show the gain. A lesson may add a `quiz` (lessons marked 🔹 in `docs/CURRICULUM.md`). Question types: `single`, `multiple`, `trueFalse`, `order`, `match`, `sort`, written like the checks in lesson files, plus `id`, `objective`, `reviewed`, and optionally `lesson` and `card` (the card whose text answers it). Unreviewed questions are hidden in production.

## Media, drawings and audio

- **Media slots.** A lesson, a card or a step may carry `"media": [...]`. Each item is `{ "type": "image", "src": "<file in content/media>" }` or `{ "type": "video", "youtubeId": "..." }`, plus `alt` (`ar`, `en`), `credit`, `sourceUrl` and `licence`. Every image must also be listed in `media/manifest.json` and present in `media/`; an image without credit, source or licence stops the app. Every item appears on the sources page. An empty slot shows nothing.
- **Rafiq.** `art/rafiq/` holds his poses as transparent PNGs, listed with their pixel sizes, credit and licence in `art/rafiq/manifest.json` (the app checks every pose is there at its stated size). At the board he waves at a lesson's start, then points; he is happy after a right answer, thinks while the learner chooses, and encourages after a wrong try. The "writing" pose carries its own small board and is not used beside the big one.
- **The board's drawing.** `visuals.json` names, for each lesson, the scene from `art/` pinned on its board, the parts that light up in order as the learner advances (`reveal`), those that fade away (`clear`), a part that moves to the step in focus (`follow`, e.g. the sun along the day's arc), and the natural sound behind it (`ambience`). Every part it names must exist in the scene; the app checks this. `art/manifest.json` lists every drawing with its credit and licence.
- **Listening.** Cards, steps and the lesson intro can be read aloud by the device's own voice, in the page language. Quran text is never read by that voice: verses play their real recitation (mp3quran.net, timings fetched by `scripts/fetch-content.mjs`). A hadith's Arabic text is not read aloud; its explanation is.

## Referral centres

`referral-centers.json` lists `{ id, name, kind (centre | phone | online), languages, city?, address?, phone?, email?, url?, hours?, notes?, sourceUrl, verifiedOn }`. Each needs at least one way to reach it, and `sourceUrl` names where its details were checked. Add a centre only once its details are confirmed.

