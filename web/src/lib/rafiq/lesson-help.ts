import type { Locale } from "next-intl";

import { postToRafiq, type RafiqResult } from "./answer";

/*
 * Client for Rafiq's help with one line of a lesson board: POST /api/ai/lesson-help, through the
 * same-origin rewrite to the AI service. The browser never talks to a model provider.
 */

export const LESSON_HELP_MODES = ["simpler", "example", "question"] as const;
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
};

export const LESSON_HELP_PATH = "/api/ai/lesson-help";

export function requestLessonHelp(
  request: LessonHelpRequest,
  options?: { signal?: AbortSignal; fetcher?: typeof fetch },
): Promise<RafiqResult> {
  if (request.mode === "question" && !request.question?.trim()) {
    throw new Error("A question is required in question mode");
  }
  return postToRafiq(LESSON_HELP_PATH, request, options);
}
