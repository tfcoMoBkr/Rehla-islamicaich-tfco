// Builds Rafiq's source corpus in content/corpus/ (git-ignored): books split at their own headings,
// a catalogue of hadith titles, and a few term pages. Quran and hadith texts are not stored: Rafiq
// reads them live from the MCP server. Every step resumes from what is already saved.

import path from "node:path";

import { fetchByenah } from "./byenah.mjs";
import { corpusDir, writeJson } from "./common.mjs";
import { fetchHadithCatalogue } from "./hadeethenc-catalogue.mjs";
import { fetchIslamHouseBooks } from "./islamhouse-books.mjs";
import { writePairs } from "./pairs.mjs";
import { writeCorpusIndex, writeReports } from "./reports.mjs";
import { fetchTerms } from "./terminologyenc.mjs";

async function step(name, work) {
  console.log(`${name}…`);
  try {
    return await work();
  } catch (error) {
    console.log(`  ${name} failed: ${error.message}`);
    return { failures: [error.message] };
  }
}

export async function buildCorpus({ refresh }) {
  const run = {
    byenah: await step("byenah.com book", () => fetchByenah({ refresh })),
    islamhouse: await step("IslamHouse books", () => fetchIslamHouseBooks({ refresh })),
    hadeethenc: await step("HadeethEnc catalogue", () => fetchHadithCatalogue({ refresh })),
    terminologyenc: await step("TerminologyEnc terms", () => fetchTerms({ refresh })),
  };
  await writeJson(path.join(corpusDir, ".cache", "last-run.json"), {
    byenah: run.byenah.failures ?? [],
    islamhouse: Array.isArray(run.islamhouse) ? run.islamhouse.flatMap((book) => book.failures.map((failure) => `${book.id}: ${failure}`)) : run.islamhouse.failures,
    hadeethenc: run.hadeethenc.failures ?? [],
    terminologyenc: Array.isArray(run.terminologyenc)
      ? run.terminologyenc.flatMap((term) => term.failures.map((failure) => `${term.id}: ${failure}`))
      : run.terminologyenc.failures,
  });

  const pairs = await writePairs();
  const index = await writeCorpusIndex();
  const manifest = await writeReports();
  console.log(`Books: ${index.books.length}; pairs: ${pairs.map((pair) => `${pair.book} ${pair.pairs.length}`).join(", ")}.`);
  for (const [source, entry] of Object.entries(manifest.sources)) {
    console.log(`  ${source}: ${JSON.stringify(entry.counts)} ${JSON.stringify(entry.characters)}${entry.failures.length ? ` · failures: ${entry.failures.join("; ")}` : ""}`);
  }
}
