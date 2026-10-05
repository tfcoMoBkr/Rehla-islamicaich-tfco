import type { Locale } from "next-intl";

import { postToRafiq, type RafiqResult } from "./answer";
import { HISTORY_TURNS, type Turn } from "./ask";

/*
 * Client for Rafiq's help with one line of a lesson board: POST /api/ai/lesson-help, through the
 * same-origin rewrite to the AI service. The browser never talks to a model provider.
 */

/** "explain" opens the conversation about a line; the others follow it. */
export const LESSON_HELP_MODES = ["explain", "simpler", "example", "question"] as const;
export type LessonHelpMode = (typeof LESSON_HELP_MODES)[number];

export type LessonHelpRequest = {
  lessonId: string;
  /** The card (or guided step) the line belongs to. */
  cardId: string;
  lineText: string;
  mode: LessonHelpMode;
  /** The learner's own question; required in `question` mode. */
  question?: string;
  locale: Locale;
  /** Lessons the learner completed: retrieval looks in this lesson first, then in these. */
  reachedLessonIds?: string[];
  /** The conversation so far about this lesson, kept on the device. */
  history?: Turn[];
};

export const LESSON_HELP_PATH = "/api/ai/lesson-help";

export function requestLessonHelp(
  request: LessonHelpRequest,
  options?: { signal?: AbortSignal; fetcher?: typeof fetch },
): Promise<RafiqResult> {
  if (request.mode === "question" && !request.question?.trim()) {
    throw new Error("A question is required in question mode");
  }
  const history = (request.history ?? []).slice(-HISTORY_TURNS).map((turn) => ({ ...turn, text: turn.text.slice(0, 2000) }));
  return postToRafiq(
    LESSON_HELP_PATH,
    { ...request, reachedLessonIds: request.reachedLessonIds?.length ? request.reachedLessonIds : undefined, history },
    options,
  );
}
