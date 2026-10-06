import { describe, expect, it } from "vitest";

import { EMPTY_PROGRESS, gain, withAnswer } from "./progress";
import { missedQuestions, pickProvisions } from "./provisions";

const pool = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "own" }];

describe("pickProvisions", () => {
  it("only reviews questions the learner has already met", () => {
    expect(pickProvisions(pool, EMPTY_PROGRESS, new Set())).toEqual([]);
  });

  it("puts missed questions first, then those seen longest ago, up to the limit", () => {
    let progress = withAnswer(EMPTY_PROGRESS, "a", true, 10);
    progress = withAnswer(progress, "b", true, 5);
    progress = withAnswer(progress, "c", false, 30);
    progress = withAnswer(progress, "d", true, 20);
    expect(pickProvisions(pool, progress, new Set(), 3).map((question) => question.id)).toEqual(["c", "b", "a"]);
  });

  it("leaves out the current lesson's own questions", () => {
    const progress = withAnswer(EMPTY_PROGRESS, "own", false, 1);
    expect(pickProvisions(pool, progress, new Set(["own"]))).toEqual([]);
  });
});

describe("missedQuestions", () => {
  it("returns questions whose last answer was wrong", () => {
    let progress = withAnswer(EMPTY_PROGRESS, "a", false, 1);
    progress = withAnswer(progress, "b", false, 2);
    progress = withAnswer(progress, "b", true, 3);
    expect(missedQuestions(pool, progress).map((question) => question.id)).toEqual(["a"]);
  });
});

describe("gain", () => {
  const score = (correct: number, total: number) => ({ correct, total, at: 0, answers: {} });

  it("is the difference in percentage points between baseline and exam", () => {
    expect(gain(score(1, 4), score(3, 4))).toBe(50);
  });

  it("is unknown until both have been taken", () => {
    expect(gain(score(1, 4), undefined)).toBeNull();
  });

  it("compares the same questions, before and after, when both asked them", () => {
    const before = { correct: 1, total: 3, at: 0, answers: { a: false, b: true, c: false } };
    const after = { correct: 4, total: 6, at: 1, answers: { a: true, b: true, c: false, d: true, e: true, f: false } };
    // On a, b and c: one right before, two right after.
    expect(gain(before, after)).toBe(33);
  });
});
