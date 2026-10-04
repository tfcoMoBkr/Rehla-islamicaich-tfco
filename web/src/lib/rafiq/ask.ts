import type { Locale } from "next-intl";

import { postToRafiq, type RafiqResult } from "./answer";

export const ASK_PATH = "/api/ai/ask";
export const QUESTION_MAX_LENGTH = 1000;
/** The service reads at most this many earlier turns. */
export const HISTORY_TURNS = 4;

export type Turn = { role: "user" | "assistant"; text: string };

export type AskRequest = {
  question: string;
  locale: Locale;
  /** Lessons the learner has completed: Rafiq answers at that stage and names later lessons. */
  reachedLessonIds?: string[];
  history?: Turn[];
};

export function askRafiq(
  request: AskRequest,
  options?: { signal?: AbortSignal; fetcher?: typeof fetch },
): Promise<RafiqResult> {
  const question = request.question.trim();
  if (!question || question.length > QUESTION_MAX_LENGTH) {
    throw new Error(`A question is 1 to ${QUESTION_MAX_LENGTH} characters long`);
  }
  const history = (request.history ?? []).slice(-HISTORY_TURNS).map((turn) => ({ ...turn, text: turn.text.slice(0, 2000) }));
  return postToRafiq(
    ASK_PATH,
    {
      question,
      locale: request.locale,
      ...(request.reachedLessonIds?.length ? { reachedLessonIds: request.reachedLessonIds } : {}),
      ...(history.length ? { history } : {}),
    },
    options,
  );
}
