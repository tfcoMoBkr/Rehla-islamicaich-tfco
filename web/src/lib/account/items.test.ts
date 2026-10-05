import { describe, expect, it } from "vitest";

import { EMPTY_PROGRESS, provisionsOf, type Progress } from "@/lib/learn/progress";

import { changes, fingerprint, fromItems, itemFromRow, merge, stableJson, toItems, type Snapshot } from "./items";

const score = (correct: number, total: number, at: number) => ({ correct, total, at, answers: {} });

function snapshot(progress: Partial<Progress>, tourSeen = false): Snapshot {
  return { progress: { ...EMPTY_PROGRESS, ...progress }, tourSeen };
}

const joined = (device: Snapshot, account: Snapshot) => merge(device, account).progress;

describe("progress as account rows", () => {
  it("keeps the device's ids, and leaves personal checklists and the session id on the device", () => {
    const items = toItems(
      snapshot(
        {
          sessionId: "anon",
          startStation: "2",
          completedLessons: { "1.1": 10 },
          questions: { "q-1": { seen: 2, lastCorrect: true, lastSeenAt: 20 } },
          quizzes: { "1.1": score(3, 4, 30) },
          baselines: { "1": score(1, 4, 5) },
          exams: { "1": { ...score(4, 4, 40), passed: true } },
          picks: { "1.6": "p2" },
          checklists: { "1.6:list": ["a"] },
          practice: { earned: { "activity:2.4:a1": { points: 3, at: 50 } }, best: { "2.4:a1": { correct: 2, total: 3, at: 60 } } },
        },
        true,
      ),
    );
    expect(items.map((item) => item.id).sort()).toEqual(
      ["baseline:1", "best:2.4:a1", "earned:activity:2.4:a1", "exam:1", "lesson:1.1", "pick:1.6", "question:q-1", "quiz:1.1", "start", "tour"].sort(),
    );
    expect(JSON.stringify(items)).not.toContain("anon");
    expect(JSON.stringify(items)).not.toContain("1.6:list");
  });

  it("reads back what it wrote, and ignores rows it does not understand", () => {
    const device = snapshot({ completedLessons: { "1.1": 10 }, practice: { earned: { "question:q-1": { points: 1, at: 5 } }, best: {} } }, true);
    const rows = toItems(device).map((item) => ({ item_id: item.id, kind: item.kind, value: item.value }));
    const items = [...rows, { item_id: "lesson:9", kind: "lessonCompleted", value: { at: "yesterday" } }, { item_id: "x", kind: "religion", value: {} }].flatMap(
      (row) => itemFromRow(row) ?? [],
    );
    expect(fromItems(items)).toEqual(snapshot({ completedLessons: { "1.1": 10 }, practice: { earned: { "question:q-1": { points: 1, at: 5 } }, best: {} } }, true));
  });

  it("sees a value as unchanged however the database ordered its keys", () => {
    const [item] = toItems(snapshot({ quizzes: { "1.1": score(3, 4, 30) } }));
    expect(stableJson({ b: 1, a: { d: 2, c: 3 } })).toBe(stableJson({ a: { c: 3, d: 2 }, b: 1 }));
    expect(changes(new Map([["quiz:1.1", stableJson({ value: { total: 4, answers: {}, at: 30, correct: 3 }, kind: "quiz" })]]), [item!])).toEqual({
      upserts: [],
      removals: [],
    });
    expect(fingerprint(item!)).toBe(stableJson({ kind: "quiz", value: { at: 30, answers: {}, correct: 3, total: 4 } }));
  });

  it("writes what changed and removes what the device no longer holds", () => {
    const items = toItems(snapshot({ completedLessons: { "1.1": 10, "1.2": 20 } }));
    const stored = new Map([
      ["lesson:1.1", fingerprint(items[0]!)],
      ["lesson:1.3", "{}"],
    ]);
    expect(changes(stored, items)).toEqual({ upserts: [items[1]], removals: ["lesson:1.3"] });
  });
});

describe("joining a device's progress with an account's", () => {
  it("keeps every item either side holds", () => {
    const merged = joined(snapshot({ completedLessons: { "1.1": 10 } }), snapshot({ completedLessons: { "1.2": 20 } }));
    expect(merged.completedLessons).toEqual({ "1.1": 10, "1.2": 20 });
  });

  it("dates a completed lesson from its first completion", () => {
    expect(joined(snapshot({ completedLessons: { "1.1": 30 } }), snapshot({ completedLessons: { "1.1": 10 } })).completedLessons["1.1"]).toBe(10);
  });

  it("keeps the starting station this device chose, or the account's when it chose none", () => {
    expect(joined(snapshot({ startStation: "2" }), snapshot({ startStation: "3" })).startStation).toBe("2");
    expect(joined(snapshot({}), snapshot({ startStation: "3" })).startStation).toBe("3");
  });

  it("keeps a question's latest answer and its highest count", () => {
    const merged = joined(
      snapshot({ questions: { q: { seen: 5, lastCorrect: false, lastSeenAt: 10 } } }),
      snapshot({ questions: { q: { seen: 2, lastCorrect: true, lastSeenAt: 20 } } }),
    );
    expect(merged.questions.q).toEqual({ seen: 5, lastCorrect: true, lastSeenAt: 20 });
  });

  it("keeps the latest quiz, but the first baseline: it records what was known before the station", () => {
    const merged = joined(
      snapshot({ quizzes: { "1.1": score(1, 4, 10) }, baselines: { "1": score(3, 4, 50) } }),
      snapshot({ quizzes: { "1.1": score(4, 4, 20) }, baselines: { "1": score(1, 4, 5) } }),
    );
    expect(merged.quizzes["1.1"]).toEqual(score(4, 4, 20));
    expect(merged.baselines["1"]).toEqual(score(1, 4, 5));
  });

  it("keeps a passed exam over a later failed one, and otherwise the latest", () => {
    const passed = { ...score(4, 4, 10), passed: true };
    const failedLater = { ...score(1, 4, 90), passed: false };
    expect(joined(snapshot({ exams: { "1": failedLater } }), snapshot({ exams: { "1": passed } })).exams["1"]).toEqual(passed);
    const secondPass = { ...score(3, 4, 99), passed: true };
    expect(joined(snapshot({ exams: { "1": passed } }), snapshot({ exams: { "1": secondPass } })).exams["1"]).toEqual(secondPass);
  });

  it("keeps the sentence chosen on this device", () => {
    expect(joined(snapshot({ picks: { "1.6": "mine" } }), snapshot({ picks: { "1.6": "theirs", "2.1": "other" } })).picks).toEqual({ "1.6": "mine", "2.1": "other" });
  });

  it("counts provisions once per id and never lowers the total", () => {
    const device = snapshot({ practice: { earned: { a: { points: 2, at: 30 }, b: { points: 1, at: 5 } }, best: {} } });
    const account = snapshot({ practice: { earned: { a: { points: 3, at: 10 }, c: { points: 4, at: 7 } }, best: {} } });
    const merged = joined(device, account);
    expect(merged.practice.earned).toEqual({ a: { points: 3, at: 10 }, b: { points: 1, at: 5 }, c: { points: 4, at: 7 } });
    expect(provisionsOf(merged)).toBe(8);
    expect(provisionsOf(merged)).toBeGreaterThanOrEqual(Math.max(provisionsOf(device.progress), provisionsOf(account.progress)));
    // Joining again (another page load) adds nothing.
    expect(provisionsOf(joined(snapshot(merged), account))).toBe(8);
  });

  it("keeps an activity's best round: the higher share right, the later one on a tie", () => {
    const merged = joined(
      snapshot({ practice: { earned: {}, best: { x: { correct: 2, total: 4, at: 50 }, y: { correct: 1, total: 2, at: 10 } } } }),
      snapshot({ practice: { earned: {}, best: { x: { correct: 3, total: 4, at: 5 }, y: { correct: 2, total: 4, at: 20 } } } }),
    );
    expect(merged.practice.best).toEqual({ x: { correct: 3, total: 4, at: 5 }, y: { correct: 2, total: 4, at: 20 } });
  });

  it("counts the tour as seen if either side saw it, and keeps this device's checklists", () => {
    const merged = merge(snapshot({ checklists: { k: ["a"] } }, false), snapshot({}, true));
    expect(merged.tourSeen).toBe(true);
    expect(merged.progress.checklists).toEqual({ k: ["a"] });
  });
});
