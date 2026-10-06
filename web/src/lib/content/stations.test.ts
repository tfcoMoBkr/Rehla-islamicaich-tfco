import { describe, expect, it } from "vitest";

import { loadKhutuwat } from "./load";
import { lessonQuestions, stationParts } from "./lesson-view";

describe("what the learner knows before and after a station", () => {
  it("is measured on every station, from the station's lessons' own questions", async () => {
    const { road, lessons } = await loadKhutuwat();
    for (const station of road.filter((entry) => !entry.demo)) {
      const { baseline, exam } = stationParts(station, lessons, "en");
      const asking = station.lessonIds.filter((id) => {
        const lesson = lessons.get(id);
        return lesson ? lessonQuestions(lesson, "en").length > 0 : false;
      });
      // One question from each lesson that has any.
      expect(exam.map((question) => question.lessonId), station.id).toEqual(asking);
      expect(baseline.length, station.id).toBe(3);
      const examIds = new Set(exam.map((question) => question.id));
      // The check before the station asks the same items as its exam, so the gain compares like with like.
      for (const question of baseline) expect(examIds.has(question.id), question.id).toBe(true);
    }
  });

  it("keeps a station's own questions when its file lists them", async () => {
    const { road, practice, lessons } = await loadKhutuwat();
    const demo = [...road, ...practice].find((entry) => entry.baseline.length > 0);
    if (!demo) return;
    expect(stationParts(demo, lessons, "en").baseline.map((question) => question.id)).toEqual(demo.baseline.map((question) => question.id));
  });
});
