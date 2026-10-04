// Writes docs/SOURCES.md from content/sources.json, the same file the /sources page renders.
// Run with `npm run content:sources` from web/.

import { readFile, writeFile } from "node:fs/promises";
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
];

const STATUS = { approved: "Approved", pendingReview: "Pending review" };

const cell = (text) => text.replaceAll("|", "\\|").replaceAll("\n", " ");

/**
 * @param {{ id: string; type: string; name: { en: string }; url: string; alsoAt: string[];
 *   usedFor: { en: string }; licence: { en: string }; status: "approved" | "pendingReview";
 *   verifiedOn: string }[]} sources
 * @returns {string}
 */
export function renderSourcesDoc(sources) {
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
      const links = [source.url, ...source.alsoAt].map((url) => `<${url}>`).join("<br>");
      lines.push(
        `| ${cell(source.name.en)} (\`${source.id}\`) | ${links} | ${cell(source.usedFor.en)} | ${cell(source.licence.en)} | ${STATUS[source.status]} | ${source.verifiedOn} |`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const { sources } = JSON.parse(await readFile(path.join(root, "content", "sources.json"), "utf8"));
  await writeFile(path.join(root, "docs", "SOURCES.md"), renderSourcesDoc(sources));
  console.log("docs/SOURCES.md updated");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
