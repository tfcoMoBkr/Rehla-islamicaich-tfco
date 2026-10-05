import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadKhutuwat, loadSituations } from "./load";
import type { Quote, Situation, SituationItem } from "./situation-schema";

const FETCHED = path.resolve(__dirname, "../../../../content/fetched");
const ARABIC = /[؀-ۿ]/;

async function storedText(item: SituationItem, locale: "ar" | "en"): Promise<string> {
  if (item.type === "hadith") {
    const file = JSON.parse(await readFile(path.join(FETCHED, "hadith", `${item.hadeethencId}.json`), "utf8")) as {
      languages: Record<string, { hadeeth: string }>;
    };
    return file.languages[locale]!.hadeeth;
  }
  if (item.type === "quran") {
    const file = JSON.parse(await readFile(path.join(FETCHED, "quran", `${item.ref.replace(":", "-")}.json`), "utf8")) as {
      arabic: string;
      translations: { en: { text: string } };
    };
    return locale === "ar" ? file.arabic : file.translations.en.text;
  }
  return item.textRef[locale].excerpt;
}

function quotes(situation: Situation): Quote[] {
  const found: Quote[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (typeof record.ref === "string" && typeof record.ar === "string" && typeof record.en === "string") found.push(record as Quote);
    Object.values(record).forEach(visit);
  };
  visit({ learn: situation.learn, exchanges: situation.exchanges, check: situation.check });
  return found;
}

function teamTexts(situation: Situation): { ar: string; en: string }[] {
  const found: { ar: string; en: string }[] = [situation.title, situation.scene, situation.character];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const text = (record.text ?? record.prompt) as { ar?: unknown; en?: unknown } | undefined;
    if (text && typeof text.ar === "string" && typeof text.en === "string") found.push(text as { ar: string; en: string });
    Object.values(record).forEach(visit);
  };
  visit({ exchanges: situation.exchanges, check: situation.check });
  return found;
}

const words = (text: string) =>
  text
    .replace(/[ً-ٰٟـ]/g, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

describe("Mawqif situations", () => {
  it("are ten or more, each valid against the schema", async () => {
    expect((await loadSituations()).length).toBeGreaterThanOrEqual(10);
  });

  it("quote their sources word for word, in both languages, from the stored texts", async () => {
    let checked = 0;
    for (const situation of await loadSituations()) {
      for (const quote of quotes(situation)) {
        const item = situation.items.find((candidate) => candidate.id === quote.ref)!;
        for (const locale of ["ar", "en"] as const) {
          const text = await storedText(item, locale);
          expect(text.includes(quote[locale]), `${situation.id} ${quote.ref} (${locale}): «${quote[locale]}»`).toBe(true);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("quote book passages that are themselves exact excerpts of the stored paragraph", async () => {
    for (const situation of await loadSituations()) {
      for (const item of situation.items) {
        if (item.type !== "book") continue;
        for (const locale of ["ar", "en"] as const) {
          const ref = item.textRef[locale];
          const section = JSON.parse(await readFile(path.join(FETCHED, "books", ref.book, `${ref.section}.json`), "utf8")) as {
            paragraphs: { index: number; text: string; quranGlyphs?: boolean }[];
          };
          const paragraph = section.paragraphs.find((candidate) => candidate.index === ref.paragraph);
          expect(paragraph?.quranGlyphs, `${situation.id} ${item.id}`).not.toBe(true);
          expect(paragraph?.text.includes(ref.excerpt), `${situation.id} ${item.id} (${locale})`).toBe(true);
        }
      }
    }
  });

  it("show every source they list, and list only stored hadiths that exist in both languages", async () => {
    for (const situation of await loadSituations()) {
      const quoted = new Set(quotes(situation).map((quote) => quote.ref));
      for (const item of situation.items) {
        expect(quoted.has(item.id), `${situation.id}: ${item.id} is never quoted`).toBe(true);
        if (item.type === "hadith") {
          expect(item.availableIn).toEqual(["ar", "en"]);
          // The citation is HadeethEnc's own attribution, never typed by hand.
          const stored = JSON.parse(await readFile(path.join(FETCHED, "hadith", `${item.hadeethencId}.json`), "utf8")) as {
            languages: { ar: { attribution: string } };
          };
          expect(item.citation, `${situation.id} ${item.id}`).toBe(stored.languages.ar.attribution);
        }
      }
    }
  });

  it("are parallel in Arabic and English: every team line in its own script, every quote in both", async () => {
    for (const situation of await loadSituations()) {
      for (const text of teamTexts(situation)) {
        expect(ARABIC.test(text.ar), `${situation.id}: «${text.ar}»`).toBe(true);
        expect(ARABIC.test(text.en), `${situation.id}: "${text.en}"`).toBe(false);
      }
      for (const quote of quotes(situation)) {
        expect(ARABIC.test(quote.ar), `${situation.id} ${quote.ref}`).toBe(true);
        expect(ARABIC.test(quote.en), `${situation.id} ${quote.ref}`).toBe(false);
      }
    }
  });

  it("never write a verse or a hadith in the team's own lines", async () => {
    for (const situation of await loadSituations()) {
      for (const locale of ["ar", "en"] as const) {
        const sacred: string[] = [];
        for (const item of situation.items) if (item.type !== "book") sacred.push(words(await storedText(item, locale)).join(" "));
        for (const text of teamTexts(situation)) {
          const own = words(text[locale]);
          for (let start = 0; start + 5 <= own.length; start += 1) {
            const run = own.slice(start, start + 5).join(" ");
            expect(sacred.some((source) => source.includes(run)), `${situation.id} (${locale}): «${text[locale]}»`).toBe(false);
          }
        }
      }
    }
  });

  it("point to lessons that exist", async () => {
    const { lessons } = await loadKhutuwat();
    for (const situation of await loadSituations()) {
      for (const id of situation.relatedLessons) expect(lessons.has(id), `${situation.id}: ${id}`).toBe(true);
    }
  });
});
