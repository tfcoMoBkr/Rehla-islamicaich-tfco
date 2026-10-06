/*
 * The learner's progress. It lives on this device, under an anonymous random session id: no name,
 * no contact data, nothing inferred about the person. A learner who signs in to an optional account
 * also keeps it there (src/lib/account/sync.ts).
 */

export type ScoreRecord = {
  correct: number;
  total: number;
  at: number;
  /** Per question: answered correctly on the first try. */
  answers: Record<string, boolean>;
};

export type ExamRecord = ScoreRecord & { passed: boolean };

export type QuestionHistory = { seen: number; lastCorrect: boolean; lastSeenAt: number };

/**
 * Practice: the provisions earned, keyed by what earned them ("activity:2.4:a1", "question:…"),
 * each once, and the best round of each activity. Records keyed by id merge without conflict, so
 * an account added later can join two devices' practice.
 */
export type PracticeRecord = {
  earned: Record<string, { points: number; at: number }>;
  best: Record<string, { correct: number; total: number; at: number }>;
};

export type Progress = {
  version: 1;
  sessionId: string | null;
  /** The station the learner chose to start from. Chosen by them, never inferred. */
  startStation: string | null;
  completedLessons: Record<string, number>;
  questions: Record<string, QuestionHistory>;
  quizzes: Record<string, ScoreRecord>;
  baselines: Record<string, ScoreRecord>;
  exams: Record<string, ExamRecord>;
  /** The sentence the learner chose on a lesson's journal page, by lesson id. */
  picks: Record<string, string>;
  checklists: Record<string, string[]>;
  practice: PracticeRecord;
};

export const EMPTY_PROGRESS: Progress = Object.freeze({
  version: 1,
  sessionId: null,
  startStation: null,
  completedLessons: {},
  questions: {},
  quizzes: {},
  baselines: {},
  exams: {},
  picks: {},
  checklists: {},
  practice: { earned: {}, best: {} },
});

export function withAnswer(progress: Progress, questionId: string, correct: boolean, now: number): Progress {
  const previous = progress.questions[questionId];
  return {
    ...progress,
    questions: {
      ...progress.questions,
      [questionId]: { seen: (previous?.seen ?? 0) + 1, lastCorrect: correct, lastSeenAt: now },
    },
  };
}

/** Adds provisions for something done right, once: a second time changes nothing, and nothing is ever taken away. */
export function withProvisions(progress: Progress, id: string, points: number, now: number): Progress {
  if (progress.practice.earned[id] || points <= 0) return progress;
  return {
    ...progress,
    practice: { ...progress.practice, earned: { ...progress.practice.earned, [id]: { points, at: now } } },
  };
}

export function provisionsOf(progress: Progress): number {
  return Object.values(progress.practice.earned).reduce((total, earned) => total + earned.points, 0);
}

/** Keeps an activity's best round: the higher share right, the later one on a tie. */
export function withBestRound(progress: Progress, key: string, correct: number, total: number, now: number): Progress {
  const previous = progress.practice.best[key];
  if (previous && ratio(previous) > ratio({ correct, total })) return progress;
  return {
    ...progress,
    practice: { ...progress.practice, best: { ...progress.practice.best, [key]: { correct, total, at: now } } },
  };
}

export function summarize(answers: Record<string, boolean>, now: number): ScoreRecord {
  const values = Object.values(answers);
  return { correct: values.filter(Boolean).length, total: values.length, at: now, answers };
}

export function ratio(score: Pick<ScoreRecord, "correct" | "total">): number {
  return score.total === 0 ? 0 : score.correct / score.total;
}

/**
 * Understanding gain between "what do I know?" and the station exam, in percentage points:
 * measured on the questions both asked when they share some (the same items, before and after),
 * otherwise on the two scores.
 */
export function gain(baseline: ScoreRecord | undefined, exam: ScoreRecord | undefined): number | null {
  if (!baseline || !exam) return null;
  const shared = Object.keys(baseline.answers ?? {}).filter((id) => id in (exam.answers ?? {}));
  if (shared.length === 0) return Math.round((ratio(exam) - ratio(baseline)) * 100);
  const right = (answers: Record<string, boolean>) => shared.filter((id) => answers[id]).length;
  return Math.round(((right(exam.answers) - right(baseline.answers)) / shared.length) * 100);
}
