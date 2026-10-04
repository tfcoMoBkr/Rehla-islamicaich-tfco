import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { collectMedia, renderSourcesDoc } from "../../../scripts/generate-sources-doc.mjs";

import { toLessonView } from "./lesson-view";
import { loadArtManifest, loadFiqhEncyclopedia, loadKhutuwat, loadRafiqManifest, loadSources, loadVisuals } from "./load";
import { toVisualView } from "./visual-view";

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
    const [khutuwat, sources, encyclopedia] = await Promise.all([loadKhutuwat(), loadSources(), loadFiqhEncyclopedia()]);
    for (const lesson of khutuwat.lessons.values()) {
      for (const locale of ["ar", "en"] as const) {
        const view = await toLessonView(lesson, khutuwat, locale, sources, encyclopedia);
        expect(view.cards.length, `${lesson.id} ${locale}`).toBe(lesson.cards.length);
        // Every activity the file keeps is rendered; a lesson whose activities all lost their items has none.
        expect(view.activities.length, `${lesson.id} ${locale}`).toBe(lesson.activities.length);
      }
    }
  });

  it("shows a hadith only in a language its source has, and the citation otherwise", async () => {
    vi.stubEnv("CONTENT_SHOW_DRAFTS", "true");
    const [khutuwat, sources, encyclopedia] = await Promise.all([loadKhutuwat(), loadSources(), loadFiqhEncyclopedia()]);
    for (const lesson of khutuwat.lessons.values()) {
      for (const locale of ["ar", "en"] as const) {
        const view = await toLessonView(lesson, khutuwat, locale, sources, encyclopedia);
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
    const [khutuwat, sources, encyclopedia] = await Promise.all([loadKhutuwat(), loadSources(), loadFiqhEncyclopedia()]);
    const practice = khutuwat.lessons.get("practice-1");
    expect(practice).toBeDefined();
    if (!practice) return;
    const view = await toLessonView(practice, khutuwat, "en", sources, encyclopedia);
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

  it("lists every drawing in content/art/ in its manifest, and nothing else", async () => {
    const art = path.resolve(process.cwd(), "..", "content", "art");
    const files = (
      await Promise.all(["scenes", "icons"].map(async (dir) => (await readdir(path.join(art, dir))).map((name) => `${dir}/${name}`)))
    ).flat();
    const { items } = await loadArtManifest();
    expect(items.map((item) => item.file).sort()).toEqual(files.sort());
  });

  it("has every pose of Rafiq, each at the pixel size its manifest gives", async () => {
    const art = path.resolve(process.cwd(), "..", "content", "art");
    const { poses } = await loadRafiqManifest();
    for (const pose of poses) {
      // A PNG's width and height are the two big-endian integers after its 16-byte signature and IHDR header.
      const png = await readFile(path.join(art, pose.file));
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], pose.file).toEqual([pose.width, pose.height]);
    }
  });

  it("gives every lesson a drawing whose named parts exist in its scenes", async () => {
    vi.stubEnv("CONTENT_SHOW_DRAFTS", "true");
    const [visuals, { lessons }] = await Promise.all([loadVisuals(), loadKhutuwat()]);
    for (const lesson of lessons.values()) {
      if (lesson.status === "demo") continue;
      expect(visuals.some((visual) => visual.lesson === lesson.id), lesson.id).toBe(true);
      expect(await toVisualView(lesson.id), lesson.id).not.toBeNull();
    }
  });

  it("shows a drawing awaiting review only where drafts are shown", async () => {
    vi.stubEnv("CONTENT_SHOW_DRAFTS", "false");
    const pending = (await loadVisuals()).filter((visual) => visual.needsReview);
    expect(pending.map((visual) => visual.lesson)).toEqual(["3.4"]);
    for (const visual of pending) expect(await toVisualView(visual.lesson)).toBeNull();
  });

  it("keeps docs/SOURCES.md in step with content/sources.json and the media in lessons", async () => {
    vi.stubEnv("CONTENT_SHOW_DRAFTS", "true");
    const [sources, { lessons }] = await Promise.all([loadSources(), loadKhutuwat()]);
    const doc = await readFile(path.resolve(process.cwd(), "..", "docs", "SOURCES.md"), "utf8");
    expect(doc).toBe(renderSourcesDoc(sources, collectMedia([...lessons.values()])));
  });
});
