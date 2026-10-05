import { ratio, type Progress } from "@/lib/learn/progress";

import type { SituationStop } from "./types";

/*
 * Mawqif progress is kept in the learner's progress record, like Practice: provisions earned once
 * per id (practice.earned) and the best round of each check or test (practice.best). It is saved
 * the same way, on the device for a guest and in the account when signed in.
 */

/** Provisions for a turn answered with the best reply (chosen, or written and covering every point). */
export const TURN_PROVISIONS = 2;
/** Provisions for a check or test question answered right. */
export const QUESTION_PROVISIONS = 1;

export const turnKey = (situation: string, turn: string) => `mawqif:${situation}:${turn}`;
export const checkQuestionKey = (situation: string, check: string) => `mawqif:${situation}:check:${check}`;
export const checkRoundKey = (situation: string) => `mawqif:${situation}`;
export const testRoundKey = (group: string) => `mawqif-test:${group}`;
export const testQuestionKey = (group: string, situation: string, check: string) => `mawqif-test:${group}:${situation}:${check}`;

export type SituationStatus = "notStarted" | "practised" | "mastered";

/**
 * Not started; practised once any turn or its check was done; mastered when every turn was
 * answered with the best reply and its check had every question right.
 */
export function situationStatus(stop: SituationStop, progress: Progress): SituationStatus {
  const { earned, best } = progress.practice;
  const round = best[checkRoundKey(stop.id)];
  const turnsDone = stop.turns.filter((turn) => earned[turnKey(stop.id, turn)]).length;
  if (round && ratio(round) === 1 && turnsDone === stop.turns.length) return "mastered";
  const started = round !== undefined || Object.keys(earned).some((key) => key.startsWith(`mawqif:${stop.id}:`));
  return started ? "practised" : "notStarted";
}

/** The first situation not yet mastered: the next stop on the road. */
export function nextStop(stops: readonly SituationStop[], progress: Progress): SituationStop | null {
  return stops.find((stop) => situationStatus(stop, progress) !== "mastered") ?? null;
}

export type TestAnswer = { situation: string; check: string; correct: boolean };

export type TestAnalysis = {
  score: { correct: number; total: number };
  /** Situations with every question right. */
  strong: string[];
  /** Situations with a question wrong: practise them again. */
  practise: string[];
};

export function analyseTest(answers: readonly TestAnswer[]): TestAnalysis {
  const bySituation = new Map<string, boolean[]>();
  for (const answer of answers) bySituation.set(answer.situation, [...(bySituation.get(answer.situation) ?? []), answer.correct]);
  const strong: string[] = [];
  const practise: string[] = [];
  for (const [situation, results] of bySituation) (results.every(Boolean) ? strong : practise).push(situation);
  return { score: { correct: answers.filter((answer) => answer.correct).length, total: answers.length }, strong, practise };
}
