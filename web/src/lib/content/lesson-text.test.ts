import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { toLessonView } from "./lesson-view";
import { loadFiqhEncyclopedia, loadKhutuwat, loadSources } from "./load";
import type { ExcerptRef, Lesson, Source } from "./schema";

const ROOT = path.resolve(__dirname, "../../../..");
const BOOKS = path.join(ROOT, "content", "fetched", "books");

const sectionSchema = z.object({
  paragraphs: z.array(z.object({ index: z.number(), text: z.string(), quranGlyphs: z.boolean().optional() })),
});

async function lessons(): Promise<Lesson[]> {
  return [...(await loadKhutuwat()).lessons.values()];
}

function quoting(lesson: Lesson) {
  return [...lesson.cards, ...(lesson.steps ?? []), ...(lesson.afterRakah ?? [])].flatMap((item) =>
    item.textRef ? [{ item, refs: { ar: ([] as ExcerptRef[]).concat(item.textRef.ar), en: ([] as ExcerptRef[]).concat(item.textRef.en) } }] : [],
  );
}

describe("lesson text quoted from approved books", () => {
  it("finds every excerpt byte for byte in the stored paragraph it names", async () => {
    let checked = 0;
    for (const lesson of await lessons()) {
      for (const { refs } of quoting(lesson)) {
        for (const ref of [...refs.ar, ...refs.en]) {
          const where = `${lesson.id} ${ref.book}/${ref.section} [${ref.paragraph}]`;
          const file = path.join(BOOKS, ref.book, `${ref.section}.json`);
          const section = sectionSchema.parse(JSON.parse(await readFile(file, "utf8")));
          const paragraph = section.paragraphs.find((candidate) => candidate.index === ref.paragraph);
          expect(paragraph, where).toBeDefined();
          expect(paragraph?.quranGlyphs, `${where}: verses come only from quranenc`).not.toBe(true);
          expect(Buffer.from(paragraph?.text ?? "").includes(Buffer.from(ref.excerpt)), where).toBe(true);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("names, for every quoting card, a book the lesson lists", async () => {
    for (const lesson of await lessons()) {
      const keys = new Set(lesson.sources.map((source) => source.key));
      for (const { item } of quoting(lesson)) {
        expect(item.source?.length, lesson.id).toBeGreaterThan(0);
        for (const key of item.source ?? []) expect(keys.has(key), `${lesson.id}: ${key}`).toBe(true);
      }
    }
  });

  it("labels every card it does not quote, and keeps none without a verse, hadith or book", async () => {
    for (const lesson of await lessons()) {
      if (lesson.status === "demo") continue;
      for (const card of lesson.cards) {
        if (card.text) expect(card.authoring, `${lesson.id} ${card.id}`).toBe("team");
        if (!card.textRef) expect(card.evidence, `${lesson.id} ${card.id}`).toBeDefined();
      }
    }
  });
});

describe("what a lesson is allowed to show", () => {
  const OLD_SITE = ["newmuslim", "guide"].join("");
  // Build output, dependencies, and the git-ignored downloads under content/ are not the product.
  const IGNORED = ["node_modules", ".next", ".git", path.join("content", "corpus"), path.join("content", "sources")];
  const ignored = (dir: string) => IGNORED.some((part) => dir.endsWith(path.sep + part));

  async function files(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return ignored(full) ? [] : files(full);
        return /\.(json|md|ts|tsx|mjs|txt)$/.test(entry.name) ? [full] : [];
      }),
    );
    return nested.flat();
  }

  it("never names the lesson site that is not an approved source", async () => {
    const roots = ["content", "web", "docs"].map((name) => path.join(ROOT, name));
    const all = (await Promise.all(roots.map(files))).flat();
    for (const file of all) {
      expect((await readFile(file, "utf8")).toLowerCase().includes(OLD_SITE), path.relative(ROOT, file)).toBe(false);
    }
  }, 60_000);

  it("never renders a source, video or picture whose source is not approved", async () => {
    const all = await lessons();
    const [sources, encyclopedia] = await Promise.all([loadSources(), loadFiqhEncyclopedia()]);
    const lesson = all.find((candidate) => candidate.id === "2.4");
    expect(lesson).toBeDefined();
    if (!lesson) return;
    const approved = await toLessonView(lesson, (await loadKhutuwat()), "en", sources, encyclopedia);
    expect(approved.video).not.toBeNull();
    expect(approved.sources.length).toBeGreaterThan(0);

    const pending: Source[] = sources.map((source) => ({ ...source, status: "pendingReview" as const }));
    const view = await toLessonView(lesson, await loadKhutuwat(), "en", pending, encyclopedia);
    expect(view.sources).toEqual([]);
    expect(view.video).toBeNull();
    expect(view.media).toEqual([]);
    expect(view.cards.flatMap((card) => card.media)).toEqual([]);
  });

  it("names, in a fiqh lesson's fixed line, only the books it quotes", async () => {
    const all = await lessons();
    const [khutuwat, sources, encyclopedia] = await Promise.all([loadKhutuwat(), loadSources(), loadFiqhEncyclopedia()]);
    for (const lesson of all) {
      const view = await toLessonView(lesson, khutuwat, "ar", sources, encyclopedia);
      if (!encyclopedia.lessons[lesson.id]) {
        expect(view.fiqhNote, lesson.id).toBeNull();
        continue;
      }
      expect(view.fiqhNote?.books, lesson.id).toEqual(view.sources.map((source) => source.title));
      expect(view.fiqhNote?.links.every((link) => link.startsWith("https://dorar.net/feqhia/")), lesson.id).toBe(true);
    }
  });
});

describe("terms a card uses", () => {
  it("are words of the card's own text, stored verbatim and shown with their TerminologyEnc page", async () => {
    const [khutuwat, sources, encyclopedia] = await Promise.all([loadKhutuwat(), loadSources(), loadFiqhEncyclopedia()]);
    let marked = 0;
    for (const lesson of khutuwat.lessons.values()) {
      for (const card of lesson.cards.filter((candidate) => candidate.terms?.length)) {
        for (const locale of ["ar", "en"] as const) {
          const view = await toLessonView(lesson, khutuwat, locale, sources, encyclopedia);
          const shown = view.cards.find((candidate) => candidate.id === card.id);
          for (const term of card.terms ?? []) {
            marked += 1;
            expect(shown?.text, `${lesson.id} ${card.id} ${locale}`).toContain(term.word[locale]);
            const termView = shown?.terms.find((candidate) => candidate.id === term.terminologyencId);
            expect(termView?.url, `${lesson.id} ${card.id} ${locale}`).toMatch(/^https:\/\/terminologyenc\.com\//);
            expect(termView?.definition).toBeTruthy();
          }
        }
      }
    }
    expect(marked).toBeGreaterThan(0);
  });
});
