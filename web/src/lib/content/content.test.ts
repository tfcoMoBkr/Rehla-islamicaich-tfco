import { readFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { collectMedia, renderSourcesDoc } from "../../../scripts/generate-sources-doc.mjs";

import { toLessonView } from "./lesson-view";
import { loadKhutuwat, loadSources } from "./load";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("content/", () => {
  it("loads every station and lesson file and links lessons to stations", async () => {
    vi.stubEnv("CONTENT_SHOW_DRAFTS", "true");
    const { road, practice, lessons } = await loadKhutuwat();
    expect(road.map((station) => station.id)).toEqual(["1", "2", "3"]);
    expect(road.map((station) => station.lessonIds.length)).toEqual([6, 5, 8]);
    expect(practice.map((station) => station.id)).toEqual(["demo"]);
    expect(lessons.size).toBe(20);
  });

  it("hides every lesson awaiting review in production, but keeps the practice road", async () => {
    vi.stubEnv("CONTENT_SHOW_DRAFTS", "false");
    const { road, practice, lessons } = await loadKhutuwat();
    expect(road).toEqual([]);
    expect(practice.map((station) => station.id)).toEqual(["demo"]);
    expect([...lessons.values()].every((lesson) => lesson.reviewed || lesson.status === "demo")).toBe(true);
  });

  it("renders every lesson in both languages", async () => {
    vi.stubEnv("CONTENT_SHOW_DRAFTS", "true");
    const [khutuwat, sources] = await Promise.all([loadKhutuwat(), loadSources()]);
    for (const lesson of khutuwat.lessons.values()) {
      for (const locale of ["ar", "en"] as const) {
        const view = await toLessonView(lesson, khutuwat, locale, sources);
        expect(view.cards.length, `${lesson.id} ${locale}`).toBe(lesson.cards.length);
        expect(view.activities.length, `${lesson.id} ${locale}`).toBeGreaterThan(0);
      }
    }
  });

  it("shows a hadith only in a language its source has, and the citation otherwise", async () => {
    vi.stubEnv("CONTENT_SHOW_DRAFTS", "true");
    const [khutuwat, sources] = await Promise.all([loadKhutuwat(), loadSources()]);
    for (const lesson of khutuwat.lessons.values()) {
      for (const locale of ["ar", "en"] as const) {
        const view = await toLessonView(lesson, khutuwat, locale, sources);
        lesson.cards.forEach((card, index) => {
          const evidence = view.cards[index]?.evidence;
          if (card.evidence?.type !== "hadith" || evidence?.kind !== "hadith") return;
          const available = card.evidence.hadeethencId !== null && card.evidence.availableIn.includes(locale);
          if (!available) expect(evidence.hadith, `${lesson.id} ${card.id} ${locale}`).toBeNull();
          expect(evidence.citation).toBe(card.evidence.citation);
        });
      }
    }
  });

  it("has a practice lesson that shows every activity listed for checkpoint 1", async () => {
    const [khutuwat, sources] = await Promise.all([loadKhutuwat(), loadSources()]);
    const practice = khutuwat.lessons.get("practice-1");
    expect(practice).toBeDefined();
    if (!practice) return;
    const view = await toLessonView(practice, khutuwat, "en", sources);
    expect(view.issues).toEqual([]);
    const types = new Set(view.activities.map((activity) => activity.type));
    for (const type of ["order", "sort", "select", "match", "timeline", "checklist", "reflection", "guided"] as const) {
      expect(types.has(type), type).toBe(true);
    }
    expect(view.activities.some((activity) => activity.type === "select" && activity.visual === "fiveLanterns")).toBe(true);
    expect(new Set(view.quiz.map((question) => question.type))).toEqual(
      new Set(["single", "multiple", "trueFalse", "order", "match", "sort"]),
    );
  });

  it("keeps docs/SOURCES.md in step with content/sources.json and the media in lessons", async () => {
    vi.stubEnv("CONTENT_SHOW_DRAFTS", "true");
    const [sources, { lessons }] = await Promise.all([loadSources(), loadKhutuwat()]);
    const doc = await readFile(path.resolve(process.cwd(), "..", "docs", "SOURCES.md"), "utf8");
    expect(doc).toBe(renderSourcesDoc(sources, collectMedia([...lessons.values()])));
  });
});
