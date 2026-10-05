// Runs before `next build`: every content file the build reads must be present, or the build stops
// with the list of what is missing. The web project's pages are rendered at build time from
// ../content (on Vercel this needs "Include source files outside of the Root Directory in the
// Build Step", on by default); nothing in content/ is read once the site is running.
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const content = path.resolve(import.meta.dirname, "..", "..", "content");
const missing = new Set();

const need = (relative, why) => {
  if (!existsSync(path.join(content, relative))) missing.add(`content/${relative}  (${why})`);
};
const readJson = async (relative) => JSON.parse(await readFile(path.join(content, relative), "utf8"));

/** Calls `visit` on every object inside a lesson file. */
function walk(value, visit) {
  if (Array.isArray(value)) value.forEach((item) => walk(item, visit));
  else if (value && typeof value === "object") {
    visit(value);
    Object.values(value).forEach((item) => walk(item, visit));
  }
}

/** A verse reference ("2:255", or a range "21:26-27") as the files it is stored in, one per ayah. */
const quranFiles = (ref) => {
  const [surah, ayahs] = ref.split(":");
  const [first, last = first] = ayahs.split("-").map(Number);
  return Array.from({ length: last - first + 1 }, (_, index) => `fetched/quran/${surah}-${first + index}.json`);
};

if (!existsSync(content)) {
  console.error(`check-content: ${content} not found. The web build reads ../content.`);
  process.exit(1);
}

for (const file of ["sources.json", "visuals.json", "referral-centers.json", "fiqh-encyclopedia.json", "media/manifest.json", "art/manifest.json", "art/rafiq/manifest.json"]) {
  need(file, "read by every build");
}

const lessonFiles = (await readdir(path.join(content, "lessons"), { recursive: true })).filter((file) => file.endsWith(".json"));
for (const file of lessonFiles) {
  const lesson = await readJson(path.join("lessons", file));
  const where = `lesson ${lesson.id}`;
  walk(lesson, (node) => {
    if (typeof node.hadeethencId === "number") need(`fetched/hadith/${node.hadeethencId}.json`, where);
    if (node.type === "quran" && typeof node.ref === "string") quranFiles(node.ref).forEach((file) => need(file, where));
    if (typeof node.terminologyencId === "number") need(`fetched/terms/${node.terminologyencId}.json`, where);
    if (typeof node.book === "string" && typeof node.section === "string") need(`fetched/books/${node.book}/${node.section}.json`, where);
  });
  for (const entry of lesson.ayat ?? []) quranFiles(entry.ref).forEach((file) => need(file, where));
  const listens = lesson.activities.some((activity) => activity.type === "ayahByAyah" && activity.audio);
  const surah = lesson.ayat?.[0]?.ref.split(":")[0];
  if (listens && surah) need(`fetched/recitation/${surah}.json`, `${where}, ayah by ayah`);
}

const stations = (await readdir(path.join(content, "stations"))).filter((file) => file.endsWith(".json"));
if (stations.length === 0) missing.add("content/stations/*.json  (the road)");

if (existsSync(path.join(content, "visuals.json"))) {
  for (const visual of (await readJson("visuals.json")).lessons) {
    for (const scene of visual.scenes) need(`art/scenes/${scene}.svg`, `drawing of lesson ${visual.lesson}`);
  }
}
if (existsSync(path.join(content, "art/manifest.json"))) {
  for (const item of (await readJson("art/manifest.json")).items) need(`art/${item.file}`, "art manifest");
}
if (existsSync(path.join(content, "art/rafiq/manifest.json"))) {
  for (const pose of (await readJson("art/rafiq/manifest.json")).poses) need(`art/${pose.file}`, "Rafiq's poses");
}
if (existsSync(path.join(content, "media/manifest.json"))) {
  for (const image of (await readJson("media/manifest.json")).images) need(`media/${image.src}`, "media manifest");
}

if (missing.size > 0) {
  console.error(`check-content: ${missing.size} file(s) the build needs are missing:\n${[...missing].sort().map((line) => `  ${line}`).join("\n")}`);
  process.exit(1);
}
console.log(`check-content: every content file the build reads is present (${lessonFiles.length} lessons).`);
