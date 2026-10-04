#!/usr/bin/env node
// Fetches the Quran verses (with the recitation timings of their surahs) and hadiths that lesson files reference into
// content/fetched/, verbatim, with source URL, date and version, and the lesson source books from IslamHouse
// (scripts/islamhouse.mjs). Nothing here is typed by hand: the web app only ever shows what this script saved.
//
//   node scripts/fetch-content.mjs              fetch what is missing
//   node scripts/fetch-content.mjs --refresh    fetch everything again
//   node scripts/fetch-content.mjs --corpus     build Rafiq's source corpus in content/corpus/ (scripts/sources/)
//   node scripts/fetch-content.mjs --mcp-probe  list the MCP server's tools and time sample calls (docs/MCP_TOOLS.md)
//
// Keys are read from the environment or from a .env file at the repository root (see .env.example).

import { mkdir, readdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fetchIslamHouse } from "./islamhouse.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(path.join(root, ".env"));
} catch {}
const lessonsDir = path.join(root, "content", "lessons");
const fetchedDir = path.join(root, "content", "fetched");
const refresh = process.argv.includes("--refresh");

const QURANENC = "https://quranenc.com/api/v1";
const HADEETHENC = "https://hadeethenc.com/api/v1";
const MP3QURAN = "https://mp3quran.net/api/v3";
/** The English translation shown beside each verse (CLAUDE.md: approved quranenc.com translation). */
const QURAN_TRANSLATION = { en: "english_saheeh" };
/** mp3quran.net reading used for every verse's audio (1 = Ibrahim Al-Akhdar, Hafs 'an 'Asim). */
const RECITATION_READ = 1;

const today = new Date().toISOString().slice(0, 10);

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function save(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

async function lessonFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? lessonFiles(path.join(dir, entry.name))
        : entry.name.endsWith(".json")
          ? [path.join(dir, entry.name)]
          : [],
    ),
  );
  return nested.flat();
}

/** "21:26-27" → [[21, 26], [21, 27]] */
function expandRef(ref) {
  const match = /^(\d+):(\d+)(?:-(\d+))?$/.exec(ref);
  if (!match) throw new Error(`Unreadable Quran reference "${ref}"`);
  const [, surah, from, to] = match.map(Number);
  return Array.from({ length: (to || from) - from + 1 }, (_, index) => [surah, from + index]);
}

/** Collects every Quran reference, hadith and ayah-by-ayah surah a lesson points to. */
function collectReferences(lesson, found) {
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    if (value.type === "quran" && typeof value.ref === "string") expandRef(value.ref).forEach((ayah) => found.ayahs.add(ayah.join(":")));
    if (value.type === "hadith" && value.hadeethencId) {
      const languages = found.hadiths.get(value.hadeethencId) ?? new Set();
      for (const language of value.availableIn ?? []) languages.add(language);
      found.hadiths.set(value.hadeethencId, languages);
    }
    Object.values(value).forEach(visit);
  };
  visit(lesson);
  for (const ayah of lesson.ayat ?? []) {
    expandRef(ayah.ref).forEach((ref) => found.ayahs.add(ref.join(":")));
  }
}

async function fetchQuran(ayahs) {
  const bySurah = new Map();
  for (const ref of ayahs) {
    const [surah, ayah] = ref.split(":").map(Number);
    const file = path.join(fetchedDir, "quran", `${surah}-${ayah}.json`);
    if (!refresh && (await exists(file))) continue;
    bySurah.set(surah, [...(bySurah.get(surah) ?? []), ayah]);
  }
  if (bySurah.size === 0) return 0;

  const { translations } = await getJson(`${QURANENC}/translations/list`);
  const versions = Object.fromEntries(translations.map((translation) => [translation.key, translation.version]));
  let saved = 0;

  for (const [surah, wanted] of bySurah) {
    const key = QURAN_TRANSLATION.en;
    const apiUrl = `${QURANENC}/translation/sura/${key}/${surah}`;
    const { result } = await getJson(apiUrl);
    for (const ayah of wanted) {
      const entry = result.find((candidate) => Number(candidate.aya) === ayah);
      if (!entry) throw new Error(`quranenc.com has no ayah ${surah}:${ayah}`);
      await save(path.join(fetchedDir, "quran", `${surah}-${ayah}.json`), {
        ref: `${surah}:${ayah}`,
        arabic: entry.arabic_text,
        translations: {
          en: {
            key,
            version: versions[key] ?? null,
            text: entry.translation,
            footnotes: entry.footnotes || null,
          },
        },
        source: {
          publisher: "quranenc.com",
          url: `https://quranenc.com/en/browse/${key}/${surah}#${ayah}`,
          apiUrl,
          fetchedOn: today,
        },
      });
      saved += 1;
    }
  }
  return saved;
}

async function fetchHadiths(hadiths) {
  let saved = 0;
  for (const [id, languages] of hadiths) {
    const file = path.join(fetchedDir, "hadith", `${id}.json`);
    if (!refresh && (await exists(file))) continue;
    const versions = {};
    for (const language of [...languages].sort()) {
      const apiUrl = `${HADEETHENC}/hadeeths/one/?language=${language}&id=${id}`;
      const data = await getJson(apiUrl);
      versions[language] = {
        title: data.title,
        hadeeth: data.hadeeth,
        attribution: data.attribution,
        grade: data.grade,
        explanation: data.explanation,
        hints: data.hints ?? [],
        url: `https://hadeethenc.com/${language}/browse/hadith/${id}`,
        apiUrl,
        // The HadeethEnc API publishes no version number; the fetch date stands in for it.
        version: null,
        fetchedOn: today,
      };
    }
    await save(file, { id: Number(id), publisher: "hadeethenc.com", languages: versions });
    saved += 1;
  }
  return saved;
}

async function fetchRecitations(surahs) {
  let saved = 0;
  let reads = null;
  for (const surah of [...surahs].sort((a, b) => a - b)) {
    const file = path.join(fetchedDir, "recitation", `${surah}.json`);
    if (!refresh && (await exists(file))) continue;
    reads ??= await getJson(`${MP3QURAN}/ayat_timing/reads`);
    const read = reads.find((candidate) => candidate.id === RECITATION_READ);
    if (!read) throw new Error(`mp3quran.net has no reading ${RECITATION_READ}`);
    const timingUrl = `${MP3QURAN}/ayat_timing?surah=${surah}&read=${RECITATION_READ}`;
    const timings = await getJson(timingUrl);
    await save(file, {
      surah,
      read: RECITATION_READ,
      reciter: read.name,
      rewaya: read.rewaya,
      audioUrl: `${read.folder_url}${String(surah).padStart(3, "0")}.mp3`,
      ayahs: timings.map((timing) => ({ ayah: timing.ayah, start: timing.start_time, end: timing.end_time })),
      source: { publisher: "mp3quran.net", apiUrl: timingUrl, fetchedOn: today },
    });
    saved += 1;
  }
  return saved;
}

/** Asks for the first bytes only: a real recording answers 200 or 206 with an audio type. */
async function isAudio(url) {
  try {
    const response = await fetch(url, { headers: { Range: "bytes=0-1" }, signal: AbortSignal.timeout(20000) });
    await response.body?.cancel();
    const type = response.headers.get("content-type") ?? "";
    return (response.status === 200 || response.status === 206) && type.startsWith("audio/");
  } catch {
    return false;
  }
}

/**
 * Checks that every saved recitation points at a real recording. A wrong URL is rebuilt from the
 * reading's folder_url; if that fails too, the script stops rather than leave a silent button.
 */
async function verifyRecitations() {
  const dir = path.join(fetchedDir, "recitation");
  const files = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort((a, b) => parseInt(a) - parseInt(b));
  let reads = null;
  for (const name of files) {
    const file = path.join(dir, name);
    const recitation = JSON.parse(await readFile(file, "utf8"));
    if (await isAudio(recitation.audioUrl)) continue;
    reads ??= await getJson(`${MP3QURAN}/ayat_timing/reads`);
    const read = reads.find((candidate) => candidate.id === recitation.read);
    const rebuilt = read && `${read.folder_url}${String(recitation.surah).padStart(3, "0")}.mp3`;
    if (!rebuilt || !(await isAudio(rebuilt))) {
      throw new Error(`Recitation of surah ${recitation.surah} is not a playable recording: ${recitation.audioUrl}`);
    }
    await save(file, { ...recitation, audioUrl: rebuilt });
    console.log(`Recitation of surah ${recitation.surah}: URL corrected to ${rebuilt}`);
  }
  return files.length;
}

async function fetchLessonContent() {
  const found = { ayahs: new Set(), hadiths: new Map(), recitations: new Set() };
  for (const file of await lessonFiles(lessonsDir)) {
    collectReferences(JSON.parse(await readFile(file, "utf8")), found);
  }
  // Every verse shown in a lesson can be heard in a real recitation, so fetch timings for each surah cited.
  for (const ref of found.ayahs) found.recitations.add(Number(ref.split(":")[0]));

  const [ayahs, hadiths, recitations] = [
    await fetchQuran(found.ayahs),
    await fetchHadiths(found.hadiths),
    await fetchRecitations(found.recitations),
  ];
  const verified = await verifyRecitations();
  console.log(
    `Referenced: ${found.ayahs.size} ayahs, ${found.hadiths.size} hadiths, ${found.recitations.size} recitations.`,
    `Fetched now: ${ayahs} ayahs, ${hadiths} hadiths, ${recitations} recitations.`,
    `Recordings verified: ${verified}.`,
  );
  await fetchIslamHouse({ root, today, refresh });
}

if (process.argv.includes("--corpus")) {
  const { buildCorpus } = await import("./sources/corpus.mjs");
  await buildCorpus({ refresh });
} else if (process.argv.includes("--mcp-probe")) {
  const { probeMcp } = await import("./sources/mcp-probe.mjs");
  await probeMcp();
} else {
  await fetchLessonContent();
}
