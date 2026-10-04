/*
 * The learner's progress. It lives only on this device, under an anonymous random session id:
 * no name, no contact data, nothing inferred about the person.
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

export function summarize(answers: Record<string, boolean>, now: number): ScoreRecord {
  const values = Object.values(answers);
  return { correct: values.filter(Boolean).length, total: values.length, at: now, answers };
}

export function ratio(score: Pick<ScoreRecord, "correct" | "total">): number {
  return score.total === 0 ? 0 : score.correct / score.total;
}

/** Understanding gain between "what do I know?" and the station exam, in percentage points. */
export function gain(baseline: ScoreRecord | undefined, exam: ScoreRecord | undefined): number | null {
  if (!baseline || !exam) return null;
  return Math.round((ratio(exam) - ratio(baseline)) * 100);
}
