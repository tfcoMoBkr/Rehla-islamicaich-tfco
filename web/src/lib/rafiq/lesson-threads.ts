import * as z from "zod/mini";

import { deviceStore } from "@/lib/device-store";

import { rafiqAnswerSchema, type RafiqResult } from "./answer";
import { LESSON_HELP_MODES, type LessonHelpMode } from "./lesson-help";

/*
 * The conversation beside each lesson's board, kept on this device per lesson so it is there when
 * the learner comes back to the lesson, and cleared with the rest of what Rafiq remembers.
 */

export type LessonSubject = { cardId: string; line: string };
export type LessonExchange = {
  id: number;
  at: number;
  subject: LessonSubject;
  mode: LessonHelpMode;
  /** What the learner said: their question, or the quick reply they chose (empty for "explain"). */
  said: string;
  result: RafiqResult;
};

const resultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("answer"), answer: rafiqAnswerSchema }),
  z.object({ kind: z.literal("rateLimited") }),
  z.object({ kind: z.literal("unavailable") }),
  z.object({ kind: z.literal("error") }),
]);
const exchangeSchema = z.object({
  id: z.int(),
  at: z.number(),
  subject: z.object({ cardId: z.string(), line: z.string() }),
  mode: z.enum(LESSON_HELP_MODES),
  said: z.string(),
  result: resultSchema,
});
const threadsSchema = z.record(z.string(), z.array(exchangeSchema));

type Threads = Record<string, LessonExchange[]>;

const threads = deviceStore<Threads>("rehla.lessons.v1", (raw) => threadsSchema.parse(JSON.parse(raw)), JSON.stringify);
const NO_THREAD: LessonExchange[] = [];

export function useLessonThread(lessonId: string): LessonExchange[] {
  return threads.use()?.[lessonId] ?? NO_THREAD;
}

export function readLessonThread(lessonId: string): LessonExchange[] {
  return threads.read()?.[lessonId] ?? NO_THREAD;
}

/** Keeps a reply in the lesson's thread; a retried question keeps its place. */
export function keepLessonExchange(lessonId: string, exchange: Omit<LessonExchange, "at">): void {
  const kept: LessonExchange = { ...exchange, at: Date.now() };
  const all = threads.read() ?? {};
  const thread = all[lessonId] ?? [];
  const next = thread.some((item) => item.id === kept.id) ? thread.map((item) => (item.id === kept.id ? kept : item)) : [...thread, kept];
  threads.set({ ...all, [lessonId]: next });
}

export function forgetLessonThreads(): void {
  threads.set(null);
}
