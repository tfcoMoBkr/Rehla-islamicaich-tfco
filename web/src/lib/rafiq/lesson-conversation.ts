import type { Locale } from "next-intl";

import type { RafiqResult } from "./answer";
import { HISTORY_TURNS, type Turn } from "./ask";
import { requestLessonHelp, type LessonHelpMode } from "./lesson-help";
import { keepLessonExchange, readLessonThread, type LessonExchange, type LessonSubject } from "./lesson-threads";

/*
 * The conversation beside a lesson board, apart from how it looks: what Rafiq says first when the
 * panel opens, what the service is told of the thread so far, and keeping each reply on the device.
 */

export type PendingExchange = Omit<LessonExchange, "at" | "result">;

export const sameSubject = (a: LessonSubject, b: LessonSubject) => a.cardId === b.cardId && a.line === b.line;

const nextId = (thread: readonly LessonExchange[]) => Math.max(0, ...thread.map((item) => item.id)) + 1;

/** Opening the panel on a line the thread has not talked about yet: Rafiq explains it first. */
export function openingExchange(lessonId: string, subject: LessonSubject): PendingExchange | null {
  const thread = readLessonThread(lessonId);
  const last = thread.at(-1);
  if (last && sameSubject(last.subject, subject)) return null;
  return { id: nextId(thread), subject, mode: "explain", said: "" };
}

export function newExchange(lessonId: string, subject: LessonSubject, mode: LessonHelpMode, said: string): PendingExchange {
  return { id: nextId(readLessonThread(lessonId)), subject, mode, said };
}

/** What was said before an exchange, as the service reads it: the learner's words (or the line) and Rafiq's reply. */
export function historyBefore(thread: readonly LessonExchange[], id: number, replyText: (result: RafiqResult) => string): Turn[] {
  const turns: Turn[] = [];
  for (const item of thread.filter((candidate) => candidate.id < id)) {
    const reply = replyText(item.result);
    if (!reply) continue;
    turns.push({ role: "user", text: item.said || item.subject.line }, { role: "assistant", text: reply });
  }
  return turns.slice(-HISTORY_TURNS);
}

type SendOptions = {
  locale: Locale;
  reachedLessonIds: string[];
  replyText: (result: RafiqResult) => string;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
};

/** Asks Rafiq and keeps the reply in the lesson's thread (unless the learner left before it came). */
export async function sendLessonExchange(lessonId: string, exchange: PendingExchange, options: SendOptions): Promise<RafiqResult | null> {
  const { id, subject, mode, said } = exchange;
  let result: RafiqResult;
  try {
    result = await requestLessonHelp(
      {
        lessonId,
        cardId: subject.cardId,
        lineText: subject.line,
        mode,
        ...(mode === "question" ? { question: said } : {}),
        locale: options.locale,
        reachedLessonIds: options.reachedLessonIds,
        history: historyBefore(readLessonThread(lessonId), id, options.replyText),
      },
      { signal: options.signal, fetcher: options.fetcher },
    );
  } catch {
    if (options.signal?.aborted) return null;
    result = { kind: "error" };
  }
  if (options.signal?.aborted) return null;
  keepLessonExchange(lessonId, { ...exchange, result });
  return result;
}
