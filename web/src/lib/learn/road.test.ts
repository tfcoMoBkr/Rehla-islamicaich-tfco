import { describe, expect, it } from "vitest";

import { EMPTY_PROGRESS, type Progress } from "./progress";
import { nextStep, stationStatuses, type RoadStation } from "./road";

const lesson = (id: string) => ({ id, slug: `lesson-${id}` });
const road: RoadStation[] = [
  { id: "1", lessons: [lesson("1.1"), lesson("1.2")], hasBaseline: true, hasExam: true },
  { id: "2", lessons: [lesson("2.1")], hasBaseline: true, hasExam: true },
  { id: "3", lessons: [lesson("3.1")], hasBaseline: false, hasExam: true },
];

const passed = { correct: 3, total: 3, at: 1, answers: {}, passed: true };
const progress = (overrides: Partial<Progress>): Progress => ({ ...EMPTY_PROGRESS, ...overrides });

describe("stationStatuses", () => {
  it("opens only the first station on a new journey", () => {
    expect(stationStatuses(road, EMPTY_PROGRESS)).toEqual(["current", "locked", "locked"]);
  });

  it("opens the next station once the previous exam is passed", () => {
    expect(stationStatuses(road, progress({ exams: { "1": passed } }))).toEqual(["completed", "current", "locked"]);
  });

  it("does not open a station for a failed exam", () => {
    const failed = { ...passed, correct: 1, passed: false };
    expect(stationStatuses(road, progress({ exams: { "1": failed } }))).toEqual(["current", "locked", "locked"]);
  });

  it("honours the starting point the learner chose, leaving earlier stations open", () => {
    expect(stationStatuses(road, progress({ startStation: "2" }))).toEqual(["open", "current", "locked"]);
  });
});

describe("nextStep", () => {
  it("starts a station with what-do-I-know", () => {
    expect(nextStep(road, EMPTY_PROGRESS)).toEqual({ kind: "baseline", stationId: "1" });
  });

  it("then walks the lessons in order", () => {
    const state = progress({
      baselines: { "1": { correct: 1, total: 2, at: 1, answers: {} } },
      completedLessons: { "1.1": 1 },
    });
    expect(nextStep(road, state)).toEqual({ kind: "lesson", stationId: "1", lessonId: "1.2", slug: "lesson-1.2" });
  });

  it("ends a station with its exam", () => {
    const state = progress({
      baselines: { "1": { correct: 1, total: 2, at: 1, answers: {} } },
      completedLessons: { "1.1": 1, "1.2": 2 },
    });
    expect(nextStep(road, state)).toEqual({ kind: "exam", stationId: "1" });
  });

  it("rests when every station is complete", () => {
    const state = progress({ exams: { "1": passed, "2": passed, "3": passed } });
    expect(nextStep(road, state)).toEqual({ kind: "rest" });
  });
});
