import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

/*
 * Rafiq's source corpus (content/corpus/, git-ignored, built by `node scripts/fetch-content.mjs
 * --corpus`) and the lesson books in content/fetched/books/: every saved record must say where
 * it came from and hold real text. The corpus checks are skipped where it has not been built.
 */

const CONTENT = path.resolve(process.cwd(), "..", "content");
const CORPUS = path.join(CONTENT, "corpus");
const built = existsSync(CORPUS);

type Paragraph = { text: string };
type Section = { language: string; heading: string | null; paragraphs: Paragraph[]; source: { publisher: string; url: string; fetchedOn: string } };

async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => (entry.isDirectory() ? files(path.join(dir, entry.name)) : Promise.resolve([path.join(dir, entry.name)]))),
  );
  return nested.flat();
}

const readJson = async <T>(file: string): Promise<T> => JSON.parse(await readFile(file, "utf8")) as T;

/** Section files of a book directory: every .json except its index. */
async function sectionFiles(booksDir: string): Promise<string[]> {
  if (!existsSync(booksDir)) return [];
  return (await files(booksDir)).filter(
    (file) => file.endsWith(".json") && path.basename(file) !== "index.json" && !file.includes(`${path.sep}pairs${path.sep}`),
  );
}

/**
 * `headingOnly`: the lesson books in content/fetched keep their sources' headings as they are,
 * including headings with nothing under them (e.g. 1871's empty t2); the corpus saves only text.
 */
function expectSection(section: Section, where: string, { headingOnly = false } = {}) {
  expect(["ar", "en"], where).toContain(section.language);
  expect(section.source.publisher, where).toBeTruthy();
  expect(section.source.url, where).toMatch(/^https:\/\//);
  expect(section.source.fetchedOn, where).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  if (!headingOnly) expect(section.paragraphs.length, where).toBeGreaterThan(0);
  for (const paragraph of section.paragraphs) expect(paragraph.text.trim(), where).not.toBe("");
}

describe("saved source records", () => {
  it("name their source, URL and language and hold text: the lesson books in content/fetched", async () => {
    const sections = await sectionFiles(path.join(CONTENT, "fetched", "books"));
    expect(sections.length).toBeGreaterThan(0);
    for (const file of sections) expectSection(await readJson<Section>(file), path.relative(CONTENT, file), { headingOnly: true });
  });

  it.skipIf(!built)("name their source, URL and language and hold text: the corpus books", async () => {
    const sections = await sectionFiles(path.join(CORPUS, "books"));
    expect(sections.length).toBeGreaterThan(0);
    for (const file of sections) expectSection(await readJson<Section>(file), path.relative(CONTENT, file));
  });

  it.skipIf(!built)("name their source and URL and hold titles: the hadith catalogue", async () => {
    type Catalogue = {
      source: { publisher: string; url: string; fetchedOn: string };
      hadiths: { id: number; title: Partial<Record<"ar" | "en", string>>; url: Partial<Record<"ar" | "en", string>> }[];
    };
    const catalogue = await readJson<Catalogue>(path.join(CORPUS, "hadith-catalogue.json"));
    expect(catalogue.source.publisher).toBeTruthy();
    expect(catalogue.source.url).toMatch(/^https:\/\//);
    expect(catalogue.hadiths.length).toBeGreaterThan(0);
    for (const hadith of catalogue.hadiths) {
      const languages = Object.keys(hadith.url) as ("ar" | "en")[];
      expect(languages.length, `hadith ${hadith.id}`).toBeGreaterThan(0);
      for (const language of languages) {
        expect(hadith.url[language], `hadith ${hadith.id}`).toMatch(/^https:\/\/hadeethenc\.com\//);
        expect(hadith.title[language]?.trim(), `hadith ${hadith.id} ${language}`).toBeTruthy();
      }
    }
  });

  it.skipIf(!built)("name their source, URL and language and hold text: the terms", async () => {
    type Term = {
      id: number;
      source: { publisher: string; url: string };
      languages: Partial<Record<"ar" | "en", { url: string; fields: { field: string; text: string }[] }>>;
    };
    const termFiles = (await files(path.join(CORPUS, "terms"))).filter((file) => file.endsWith(".json"));
    expect(termFiles.length).toBeGreaterThan(0);
    for (const file of termFiles) {
      const term = await readJson<Term>(file);
      expect(term.source.publisher, file).toBeTruthy();
      for (const [language, page] of Object.entries(term.languages)) {
        expect(["ar", "en"], file).toContain(language);
        expect(page.url, file).toMatch(/^https:\/\/terminologyenc\.com\//);
        expect(page.fields.length, file).toBeGreaterThan(0);
        for (const field of page.fields) expect(field.text.trim(), `${file} ${field.field}`).not.toBe("");
      }
    }
  });
});

describe("content/", () => {
  it("holds no API key", async () => {
    const key = process.env.ISLAMHOUSE_API_KEY;
    // An IslamHouse API address carries the key as its first path segment.
    const keyedUrl = /api3\.islamhouse\.com\/v3\/(?!…)[^/\s"]{6,}\//;
    for (const file of await files(CONTENT)) {
      const bytes = await readFile(file);
      if (key) expect(bytes.includes(key), path.relative(CONTENT, file)).toBe(false);
      if (/\.(json|md|txt|html)$/.test(file)) expect(bytes.toString("utf8"), path.relative(CONTENT, file)).not.toMatch(keyedUrl);
    }
  }, 60_000);
});
