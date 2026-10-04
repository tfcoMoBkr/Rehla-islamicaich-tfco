import type { Progress } from "./progress";

type Reviewable = { id: string };

/**
 * «زاد الطريق» / Provisions: spaced review at the start of a lesson. Draws only on questions
 * the learner has already met, missed ones first, then those seen longest ago.
 */
export function pickProvisions<T extends Reviewable>(
  pool: readonly T[],
  progress: Progress,
  exclude: ReadonlySet<string>,
  limit = 3,
): T[] {
  return pool
    .filter((question) => !exclude.has(question.id) && progress.questions[question.id])
    .sort((a, b) => {
      const historyA = progress.questions[a.id];
      const historyB = progress.questions[b.id];
      if (historyA.lastCorrect !== historyB.lastCorrect) return historyA.lastCorrect ? 1 : -1;
      return historyA.lastSeenAt - historyB.lastSeenAt;
    })
    .slice(0, limit);
}

/** Questions the learner last answered wrongly, reviewed before a station exam. */
export function missedQuestions<T extends Reviewable>(pool: readonly T[], progress: Progress): T[] {
  return pool.filter((question) => progress.questions[question.id]?.lastCorrect === false);
}
