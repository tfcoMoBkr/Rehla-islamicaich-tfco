// Writes docs/SOURCES.md from content/sources.json (the same file the /sources page renders)
// and from the media slots of every lesson file.
// Run with `npm run content:sources` from web/.

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const GROUPS = [
  ["quran", "Quran"],
  ["hadith", "Hadith"],
  ["lessons", "Lessons"],
  ["video", "Video"],
  ["terminology", "Terminology"],
  ["referral", "Referral"],
  ["illustrations", "Illustrations"],
  ["retrieval", "Live retrieval (nothing stored)"],
  ["reference", "Further reading (links only)"],
];

const STATUS = { approved: "Approved", pendingReview: "Pending review" };

const cell = (text) => text.replaceAll("|", "\\|").replaceAll("\n", " ");

/**
 * Every media item of the given lessons, with the lessons that use it: images and videos in the
 * lesson's slots, and the video each lesson suggests at its end (credited from its source entry).
 * @param {{ id: string; media?: object[]; cards: { media?: object[] }[]; steps?: { media?: object[] }[];
 *   suggestedVideo?: Record<string, { source: string; page: string } | null> }[]} lessons
 * @returns {{ ref: string; type: string; credit: string; sourceUrl: string; licence: string; sourceId?: string; lessons: string[] }[]}
 */
export function collectMedia(lessons) {
  const byRef = new Map();
  const ordered = [...lessons].sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
  for (const lesson of ordered) {
    const items = [
      ...(lesson.media ?? []),
      ...lesson.cards.flatMap((card) => card.media ?? []),
      ...(lesson.steps ?? []).flatMap((step) => step.media ?? []),
    ];
    for (const item of items) {
      const ref = item.type === "image" ? item.src : `youtube:${item.youtubeId}`;
      const entry = byRef.get(ref) ?? {
        ref,
        type: item.type,
        credit: item.credit,
        sourceUrl: item.sourceUrl,
        licence: item.licence,
        lessons: [],
      };
      if (!entry.lessons.includes(lesson.id)) entry.lessons.push(lesson.id);
      byRef.set(ref, entry);
    }
    for (const video of Object.values(lesson.suggestedVideo ?? {}).filter(Boolean)) {
      const entry = byRef.get(video.page) ?? {
        ref: video.page,
        type: "suggested video",
        credit: "",
        sourceUrl: video.page,
        licence: "",
        sourceId: video.source,
        lessons: [],
      };
      if (!entry.lessons.includes(lesson.id)) entry.lessons.push(lesson.id);
      byRef.set(video.page, entry);
    }
  }
  return [...byRef.values()];
}

/**
 * @param {{ id: string; type: string; name: { en: string }; url?: string; alsoAt: string[];
 *   usedFor: { en: string }; licence: { en: string }; status: "approved" | "pendingReview"; unpublished?: true;
 *   verifiedOn: string }[]} sources
 * @param {ReturnType<typeof collectMedia>} media
 * @returns {string}
 */
export function renderSourcesDoc(sources, media) {
  const lines = [
    "# Sources",
    "",
    "Every source Rehla uses. Generated from `content/sources.json` by `npm run content:sources` (in `web/`); edit that file, not this one. The same data is shown to learners at `/[locale]/sources`.",
    "",
  ];
  for (const [type, title] of GROUPS) {
    const group = sources.filter((source) => source.type === type);
    if (group.length === 0) continue;
    lines.push(`## ${title}`, "", "| Source | Link | Used for | Licence | Status | Checked on |", "| --- | --- | --- | --- | --- | --- |");
    for (const source of group) {
      const urls = [...(source.url ? [source.url] : []), ...source.alsoAt];
      const links = urls.length > 0 ? urls.map((url) => `<${url}>`).join("<br>") : source.unpublished ? "No public address" : "In this repository";
      lines.push(
        `| ${cell(source.name.en)} (\`${source.id}\`) | ${links} | ${cell(source.usedFor.en)} | ${cell(source.licence.en)} | ${STATUS[source.status]} | ${source.verifiedOn} |`,
      );
    }
    lines.push("");
  }
  lines.push("## Media in lessons", "");
  if (media.length === 0) {
    lines.push("No lesson uses an image or a video yet.", "");
  } else {
    lines.push("| Media | Credit | Licence | Source | Lessons |", "| --- | --- | --- | --- | --- |");
    for (const item of media) {
      const source = sources.find((entry) => entry.id === item.sourceId);
      const credit = item.credit || (source ? `${source.name.en} (\`${source.id}\`)` : "");
      const licence = item.licence || (source ? source.licence.en : "");
      lines.push(`| ${cell(item.ref)} (${item.type}) | ${cell(credit)} | ${cell(licence)} | <${item.sourceUrl}> | ${item.lessons.join(", ")} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

async function lessonFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return lessonFiles(full);
      return entry.name.endsWith(".json") ? [full] : [];
    }),
  );
  return nested.flat();
}

async function main() {
  const { sources } = JSON.parse(await readFile(path.join(root, "content", "sources.json"), "utf8"));
  const files = await lessonFiles(path.join(root, "content", "lessons"));
  const lessons = await Promise.all(files.map(async (file) => JSON.parse(await readFile(file, "utf8"))));
  await writeFile(path.join(root, "docs", "SOURCES.md"), renderSourcesDoc(sources, collectMedia(lessons)));
  console.log("docs/SOURCES.md updated");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
