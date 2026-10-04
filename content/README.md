# content/

Data, not code. Everything a learner reads in Khutuwat comes from these files, in both languages. The app validates every file when it loads it (`web/src/lib/content/schema.ts`); an invalid file stops it with the file name and the field at fault.

```
lessons/drafts/<id>-<slug>.json   Lessons, written by the team. They define the lesson format; the engine renders them as they are.
lessons/practice/*.json           The practice lesson: neutral, non-religious sample content that shows how the engine works.
stations/<id>.json                A station: title, order, "what do I know?" and exam questions. Its lessons are those whose "station" matches.
evidence/station-<n>.json         The team's evidence research per station (references only).
fetched/                          Verses, hadiths and recitation timings, saved verbatim by scripts/fetch-content.mjs. Never edited by hand.
media/                            Lesson images, each listed in media/manifest.json with its credit, source and licence.
referral-centers.json             Verified people and centres for the "Talk to a human" page. Empty until each contact is checked.
sources.json                      Every source the product uses (rendered at /sources; docs/SOURCES.md is generated from it).
```

## How lessons appear

- A lesson with `"reviewed": false` carries a "Draft · awaiting review" label and is **hidden in production**. Set `CONTENT_SHOW_DRAFTS=true` to preview drafts on a deployed build.
- The lesson URL is `/<locale>/learn/<station>/<slug>`.
- While a lesson awaits review, its intro screen lists its `reviewNotes` and anything in the file the engine could not render.
- Every source a lesson names (`sources[].url`, video `channel`) must belong to a source in `sources.json`; otherwise the engine reports it and does not show it.

## Evidence

Cards cite Quran verses and hadiths by reference. Run this from the repository root after adding or changing references:

```bash
node scripts/fetch-content.mjs            # fetch what is missing
node scripts/fetch-content.mjs --refresh  # fetch everything again
```

It saves each verse (quranenc.com: Arabic text and the `english_saheeh` translation with its version), each hadith in every language listed in `availableIn` (hadeethenc.com: text, grade, attribution, explanation), and the ayah timings of every surah cited, so each verse can be heard in its real recitation (mp3quran.net), each with its source URL and fetch date. A hadith with no `hadeethencId`, or with no version in the learner's language, is shown as its citation only.

## Stations and questions

Station files hold the scored questions: `baseline` ("what do I know?") and `exam`, on the **same objectives**, so the journal can show the gain. A lesson may add a `quiz` (lessons marked 🔹 in `docs/CURRICULUM.md`). Question types: `single`, `multiple`, `trueFalse`, `order`, `match`, `sort`, written like the checks in lesson files, plus `id`, `objective`, `reviewed`, and optionally `lesson` and `card` (the card whose text answers it). Unreviewed questions are hidden in production.

## Media, covers and audio

- **Media slots.** A lesson, a card or a step may carry `"media": [...]`. Each item is `{ "type": "image", "src": "<file in content/media>" }` or `{ "type": "video", "youtubeId": "..." }`, plus `alt` (`ar`, `en`), `credit`, `sourceUrl` and `licence`. Every image must also be listed in `media/manifest.json` and present in `media/`; an image without credit, source or licence stops the app. Every item appears on the sources page. An empty slot shows nothing.
- **Cover.** A lesson may set `"cover"` to the motifs of its opening scene, back to front, from `dawnSky`, `sunArc`, `stars`, `water`, `path`, `lantern`. Without it, the lesson uses its station's `cover`.
- **Listening.** Cards, steps and the lesson intro can be read aloud by the device's own voice, in the page language. Quran text is never read by that voice: verses play their real recitation (mp3quran.net, timings fetched by `scripts/fetch-content.mjs`). A hadith's Arabic text is not read aloud; its explanation is.

## Referral centres

`referral-centers.json` lists `{ id, name, kind (centre | phone | online), languages, city?, address?, phone?, email?, url?, hours?, notes?, sourceUrl, verifiedOn }`. Each needs at least one way to reach it, and `sourceUrl` names where its details were checked. Add a centre only once its details are confirmed.

