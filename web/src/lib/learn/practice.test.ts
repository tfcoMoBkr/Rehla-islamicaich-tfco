import { describe, expect, it, vi } from "vitest";

import { loadKhutuwat } from "@/lib/content/load";

import { leftOutBecause, practiceCatalogue, practiceRound } from "./practice";
import { EMPTY_PROGRESS, provisionsOf, withBestRound, withProvisions } from "./progress";

describe("the practice section", () => {
  it("resolves every card to an activity of an existing road lesson, run with that lesson's data", async () => {
    const khutuwat = await loadKhutuwat();
    for (const locale of ["ar", "en"] as const) {
      const stations = await practiceCatalogue(locale);
      expect(stations.map((station) => station.id)).toEqual(khutuwat.road.map((station) => station.id));
      for (const entry of stations.flatMap((station) => station.entries)) {
        const lesson = khutuwat.lessons.get(entry.lessonId);
        expect(lesson?.status, entry.key).toBe("published");
        expect(lesson?.activities.some((activity) => activity.id === entry.activityId), entry.key).toBe(true);
        const round = await practiceRound(entry.lessonId, entry.activityId, locale);
        expect(round?.activity.id, entry.key).toBe(entry.activityId);
        expect(round?.questions.every((question) => question.lessonId === entry.lessonId), entry.key).toBe(true);
      }
    }
  });

  it("gathers every activity of the road but reflections and private checklists", async () => {
    const khutuwat = await loadKhutuwat();
    const practised = new Set((await practiceCatalogue("en")).flatMap((station) => station.entries.map((entry) => entry.key)));
    const left: string[] = [];
    for (const station of khutuwat.road) {
      for (const id of station.lessonIds) {
        for (const activity of khutuwat.lessons.get(id)?.activities ?? []) {
          const key = `${id}:${activity.id}`;
          if (!practised.has(key)) left.push(`${key} ${activity.type}`);
        }
      }
    }
    expect(left.sort()).toEqual(["1.1:a2 reflection", "1.6:a2 checklist"]);
    expect(leftOutBecause({ id: "x", title: "", instruction: null, type: "reflection", items: [] })).toBe("reflection");
  });
});

describe("provisions", () => {
  it("increase for something done right, count it once, and never decrease", () => {
    let progress = EMPTY_PROGRESS;
    progress = withProvisions(progress, "activity:2.4:a1", 3, 1);
    progress = withProvisions(progress, "question:2.4:c1:check", 1, 2);
    expect(provisionsOf(progress)).toBe(4);
    expect(provisionsOf(withProvisions(progress, "activity:2.4:a1", 3, 3))).toBe(4);
    expect(provisionsOf(withProvisions(progress, "question:wrong", -5, 4))).toBe(4);
    expect(provisionsOf(withBestRound(progress, "2.4:a1", 0, 3, 5))).toBe(4);
  });

  it("keep the best round of each activity", () => {
    let progress = withBestRound(EMPTY_PROGRESS, "2.4:a1", 2, 3, 1);
    progress = withBestRound(progress, "2.4:a1", 1, 3, 2);
    expect(progress.practice.best["2.4:a1"]).toMatchObject({ correct: 2, total: 3 });
    progress = withBestRound(progress, "2.4:a1", 3, 3, 3);
    expect(progress.practice.best["2.4:a1"]).toMatchObject({ correct: 3, total: 3 });
  });

  it("survive a reload, kept with the rest of the learner's progress and cleared with it", async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    });
    vi.resetModules();
    const first = await import("./progress-store");
    expect(first.progressActions.earn("activity:3.3:a1", 3)).toBe(true);
    expect(first.progressActions.earn("activity:3.3:a1", 3)).toBe(false);

    vi.resetModules();
    const after = await import("./progress-store");
    const { provisionsOf: count } = await import("./progress");
    expect(count(after.readProgress())).toBe(3);
    after.progressActions.forget();
    expect(storage.size).toBe(0);
    vi.unstubAllGlobals();
  });
});
