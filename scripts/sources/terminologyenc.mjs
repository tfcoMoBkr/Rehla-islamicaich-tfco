// terminologyenc.com: a fixed list of term pages, each read in Arabic and in English. Only these
// ids: no other term is looked up or guessed.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { characters, corpusDir, exists, getText, python, readJson, scriptPath, today, writeJson } from "./common.mjs";

export const TERM_IDS = [4064, 6733, 8708, 5289, 10482, 46045, 36599, 15008];
const LANGUAGES = ["ar", "en"];
const cacheDir = path.join(corpusDir, ".cache", "terminologyenc");

const pageUrl = (language, id) => `https://terminologyenc.com/${language}/browse/term/${id}`;

async function readPage(language, id, refresh) {
  const file = path.join(cacheDir, `${language}-${id}.html`);
  if (refresh || !(await exists(file))) {
    await mkdir(cacheDir, { recursive: true });
    await writeFile(file, await getText(pageUrl(language, id), { gapMs: 2000 }));
  }
  return python(scriptPath("sources", "term_page.py"), ["beautifulsoup4"], file, language);
}

export async function fetchTerms({ refresh }) {
  const results = [];
  for (const id of TERM_IDS) {
    const file = path.join(corpusDir, "terms", `${id}.json`);
    if (!refresh && (await exists(file))) {
      results.push({ id, ...(await readJson(file)), failures: [] });
      continue;
    }
    const failures = [];
    const languages = {};
    for (const language of LANGUAGES) {
      try {
        const page = await readPage(language, id, refresh);
        const fields = page.fields.filter((field) => field.id === String(id) && field.text);
        if (fields.length === 0) {
          failures.push(`${language}: the page has no fields for term ${id}`);
          continue;
        }
        languages[language] = {
          url: pageUrl(language, id),
          pageTitle: page.pageTitle,
          fields: fields.map(({ field, section, text }) => ({ field, section, text })),
          ...(page.references ? { references: page.references } : {}),
          fetchedOn: today,
        };
      } catch (error) {
        failures.push(`${language}: ${error.message}`);
      }
    }
    const record = {
      id,
      source: { publisher: "TerminologyEnc.com", url: pageUrl("en", id), fetchedOn: today },
      text: "Each field of the term exactly as its page shows it in that language: tags removed, whitespace collapsed as a browser shows it, line breaks kept.",
      languages,
    };
    if (Object.keys(languages).length > 0) await writeJson(file, record);
    results.push({ ...record, failures });
  }
  return results.map(({ id, languages = {}, failures }) => ({
    id,
    characters: Object.fromEntries(
      Object.entries(languages).map(([language, page]) => [language, characters(page.fields.map((field) => field.text))]),
    ),
    failures,
  }));
}
