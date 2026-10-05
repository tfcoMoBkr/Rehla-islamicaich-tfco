import * as z from "zod/mini";

import { EMPTY_PROGRESS, ratio, type ExamRecord, type Progress, type QuestionHistory, type ScoreRecord } from "@/lib/learn/progress";

/*
 * The learner's progress as account rows (public.progress_items): one row per thing the device
 * already records by id, under the same id. Personal checklists ("kept on this device only") and
 * the anonymous session id are not carried.
 */

/** What an account carries: the device's progress, and whether the Khutuwat tour was seen. */
export type Snapshot = { progress: Progress; tourSeen: boolean };

type Stamp = { at: number };
type Earned = { points: number; at: number };
type Best = { correct: number; total: number; at: number };

export type Item =
  | { id: string; kind: "lessonCompleted"; value: Stamp }
  | { id: string; kind: "startStation"; value: { station: string } }
  | { id: string; kind: "question"; value: QuestionHistory }
  | { id: string; kind: "quiz"; value: ScoreRecord }
  | { id: string; kind: "baseline"; value: ScoreRecord }
  | { id: string; kind: "exam"; value: ExamRecord }
  | { id: string; kind: "pick"; value: { item: string } }
  | { id: string; kind: "provision"; value: Earned }
  | { id: string; kind: "practiceBest"; value: Best }
  | { id: string; kind: "tourSeen"; value: { seen: true } };

export type ItemKind = Item["kind"];

const count = z.int().check(z.nonnegative());
const time = z.number().check(z.nonnegative());
const score = { correct: count, total: count, at: time, answers: z.record(z.string(), z.boolean()) };

const VALUE_SCHEMAS = {
  lessonCompleted: z.object({ at: time }),
  startStation: z.object({ station: z.string() }),
  question: z.object({ seen: count, lastCorrect: z.boolean(), lastSeenAt: time }),
  quiz: z.object(score),
  baseline: z.object(score),
  exam: z.object({ ...score, passed: z.boolean() }),
  pick: z.object({ item: z.string() }),
  provision: z.object({ points: z.number().check(z.positive()), at: time }),
  practiceBest: z.object({ correct: count, total: count, at: time }),
  tourSeen: z.object({ seen: z.literal(true) }),
} satisfies Record<ItemKind, z.ZodMiniType>;

/** Item ids, kept as the device store keys them. */
const PREFIX: Record<ItemKind, string> = {
  lessonCompleted: "lesson:",
  startStation: "start",
  question: "question:",
  quiz: "quiz:",
  baseline: "baseline:",
  exam: "exam:",
  pick: "pick:",
  provision: "earned:",
  practiceBest: "best:",
  tourSeen: "tour",
};

export type Row = { item_id: string; kind: string; value: unknown };

/** A stored row as an item, or null when it is not one this version understands. */
export function itemFromRow(row: Row): Item | null {
  if (!(row.kind in VALUE_SCHEMAS)) return null;
  const kind = row.kind as ItemKind;
  if (!row.item_id.startsWith(PREFIX[kind])) return null;
  const parsed = VALUE_SCHEMAS[kind].safeParse(row.value);
  return parsed.success ? ({ id: row.item_id, kind, value: parsed.data } as Item) : null;
}

export function toItems({ progress, tourSeen }: Snapshot): Item[] {
  const keyed = <K extends ItemKind, V>(kind: K, record: Record<string, V>, value: (entry: V) => Extract<Item, { kind: K }>["value"]) =>
    Object.entries(record).map(([key, entry]) => ({ id: PREFIX[kind] + key, kind, value: value(entry) }) as Item);

  return [
    ...keyed("lessonCompleted", progress.completedLessons, (at) => ({ at })),
    ...(progress.startStation ? [{ id: PREFIX.startStation, kind: "startStation", value: { station: progress.startStation } } as const] : []),
    ...keyed("question", progress.questions, (history) => history),
    ...keyed("quiz", progress.quizzes, (record) => record),
    ...keyed("baseline", progress.baselines, (record) => record),
    ...keyed("exam", progress.exams, (record) => record),
    ...keyed("pick", progress.picks, (item) => ({ item })),
    ...keyed("provision", progress.practice.earned, (earned) => earned),
    ...keyed("practiceBest", progress.practice.best, (best) => best),
    ...(tourSeen ? [{ id: PREFIX.tourSeen, kind: "tourSeen", value: { seen: true } } as const] : []),
  ];
}

/** An account's items as a snapshot; what only a device holds (checklists, session id) stays empty. */
export function fromItems(items: readonly Item[]): Snapshot {
  const progress: Progress = { ...EMPTY_PROGRESS, completedLessons: {}, questions: {}, quizzes: {}, baselines: {}, exams: {}, picks: {}, practice: { earned: {}, best: {} } };
  let tourSeen = false;
  for (const item of items) {
    const key = item.id.slice(PREFIX[item.kind].length);
    switch (item.kind) {
      case "lessonCompleted":
        progress.completedLessons[key] = item.value.at;
        break;
      case "startStation":
        progress.startStation = item.value.station;
        break;
      case "question":
        progress.questions[key] = item.value;
        break;
      case "quiz":
        progress.quizzes[key] = item.value;
        break;
      case "baseline":
        progress.baselines[key] = item.value;
        break;
      case "exam":
        progress.exams[key] = item.value;
        break;
      case "pick":
        progress.picks[key] = item.value.item;
        break;
      case "provision":
        progress.practice.earned[key] = item.value;
        break;
      case "practiceBest":
        progress.practice.best[key] = item.value;
        break;
      case "tourSeen":
        tourSeen = true;
        break;
    }
  }
  return { progress, tourSeen };
}

/** Every key of both records; where both hold one, `choose` decides between the device's and the account's. */
function union<T>(device: Record<string, T>, account: Record<string, T>, choose: (device: T, account: T) => T): Record<string, T> {
  const merged: Record<string, T> = { ...account, ...device };
  for (const [key, mine] of Object.entries(device)) {
    if (Object.hasOwn(account, key)) merged[key] = choose(mine, account[key] as T);
  }
  return merged;
}

const later = <T extends Stamp>(a: T, b: T): T => (b.at > a.at ? b : a);
const earlier = <T extends Stamp>(a: T, b: T): T => (b.at < a.at ? b : a);

/**
 * Joins this device's progress with the account's. Nothing either side holds is lost; where both
 * hold the same item, the more complete or more recent one wins (rules in docs/ARCHITECTURE.md).
 */
export function merge(device: Snapshot, account: Snapshot): Snapshot {
  const d = device.progress;
  const a = account.progress;
  return {
    tourSeen: device.tourSeen || account.tourSeen,
    progress: {
      ...d,
      startStation: d.startStation ?? a.startStation,
      completedLessons: union(d.completedLessons, a.completedLessons, Math.min),
      questions: union(d.questions, a.questions, (mine, theirs) => ({
        ...(theirs.lastSeenAt > mine.lastSeenAt ? theirs : mine),
        seen: Math.max(mine.seen, theirs.seen),
      })),
      quizzes: union(d.quizzes, a.quizzes, later),
      // What the learner knew before the station: the first attempt is the one that counts.
      baselines: union(d.baselines, a.baselines, earlier),
      exams: union(d.exams, a.exams, (mine, theirs) => (mine.passed !== theirs.passed ? (mine.passed ? mine : theirs) : later(mine, theirs))),
      picks: union(d.picks, a.picks, (mine) => mine),
      practice: {
        // One entry per id, so provisions are never counted twice, and never fewer than either side had.
        earned: union(d.practice.earned, a.practice.earned, (mine, theirs) => ({
          points: Math.max(mine.points, theirs.points),
          at: Math.min(mine.at, theirs.at),
        })),
        best: union(d.practice.best, a.practice.best, (mine, theirs) =>
          ratio(theirs) > ratio(mine) || (ratio(theirs) === ratio(mine) && theirs.at > mine.at) ? theirs : mine,
        ),
      },
    },
  };
}

/** JSON with sorted keys, so a value reads the same however the database ordered it. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : inner,
  );
}

export const fingerprint = (item: Item): string => stableJson({ kind: item.kind, value: item.value });

/** What to write to and remove from the account so that it holds `items`, given what it already holds. */
export function changes(stored: ReadonlyMap<string, string>, items: readonly Item[]): { upserts: Item[]; removals: string[] } {
  const ids = new Set(items.map((item) => item.id));
  return {
    upserts: items.filter((item) => stored.get(item.id) !== fingerprint(item)),
    removals: [...stored.keys()].filter((id) => !ids.has(id)),
  };
}
