import * as z from "zod/mini";

import { postToRafiq, type RafiqResult } from "@/lib/rafiq/answer";
import { HISTORY_TURNS, type Turn } from "@/lib/rafiq/ask";

/*
 * Mawqif practice as a real conversation, through this site's proxy: a fresh scene inside the
 * situation, the other person's next line after each reply (with the key points the reply met),
 * and feedback at the end. Rafiq explains a quote in place on request. Nothing typed is stored
 * by the service; the conversation lives on this page.
 */

export const START_PATH = "/api/ai/mawqif-start";
export const TURN_PATH = "/api/ai/mawqif-turn";
export const FEEDBACK_PATH = "/api/ai/mawqif-feedback";
export const EXPLAIN_PATH = "/api/ai/mawqif-explain";
export const PRACTICE_REPLY_MAX = 500;
/** A conversation can be ended after the learner's first reply, and ends itself after the fifth. */
export const MIN_REPLIES = 1;
export const MAX_REPLIES = 5;
/** The service answers within 20 seconds; past this the page stops waiting and says so. */
export const PRACTICE_TIMEOUT_MS = 25_000;

/** Where the conversation stands: the turn the learner is on, whether they may end it, whether it is over. */
export function turnState(replies: number, { min, max }: { min: number; max: number }) {
  return { turn: Math.min(replies + 1, max), total: max, canEnd: replies >= min, over: replies >= max };
}

/** A text field the service may leave empty or null: always a string on the page. */
const text = z.pipe(z.nullish(z.string()), z.transform((value) => value ?? ""));
const ids = z.pipe(z.nullish(z.array(z.string())), z.transform((value) => value ?? []));

const sceneSchema = z.object({
  person: text,
  place: text,
  mood: text,
  setting: text,
  line: text,
});
export type Scene = z.infer<typeof sceneSchema>;

const startSchema = z.object({ status: z.enum(["ready", "unavailable", "unknownSituation"]), scene: z.nullish(sceneSchema) });
const turnSchema = z.object({
  status: z.enum(["continued", "ended", "question", "ruling", "distress", "danger", "unavailable", "unknownSituation"]),
  line: z.nullish(z.string()),
  met: ids,
  tone: z.nullish(z.enum(["fine", "gentler"])),
});
const feedbackSchema = z.object({
  status: z.enum(["ready", "unavailable", "unknownSituation"]),
  replies: z._default(
    z.array(z.object({ n: z.number(), good: text, missing: ids, better: text })),
    [],
  ),
});

export type TurnReply = z.infer<typeof turnSchema>;
export type ReplyFeedback = z.infer<typeof feedbackSchema>["replies"][number];
export type Line = { role: "learner" | "character"; text: string };
type Options = { signal?: AbortSignal; fetcher?: typeof fetch; timeoutMs?: number };
type Unreachable = { status: "unavailable" } | { status: "rateLimited" };

async function post<T>(path: string, body: unknown, schema: z.ZodMiniType<T>, { signal, fetcher = fetch, timeoutMs = PRACTICE_TIMEOUT_MS }: Options): Promise<T | Unreachable> {
  const timeout = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetcher(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (response.status === 429) return { status: "rateLimited" };
    if (!response.ok) return { status: "unavailable" };
    const parsed = schema.safeParse(await response.json());
    return parsed.success ? parsed.data : { status: "unavailable" };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { status: "unavailable" };
  }
}

export function startScene(request: { situationId: string; locale: "ar" | "en"; avoid: string[] }, options: Options = {}) {
  return post(START_PATH, request, startSchema, options);
}

export function takeTurn(
  request: { situationId: string; locale: "ar" | "en"; scene: Scene; history: Line[]; reply: string },
  options: Options = {},
) {
  return post(TURN_PATH, { ...request, reply: request.reply.trim().slice(0, PRACTICE_REPLY_MAX) }, turnSchema, options);
}

/** `met` is what the turns found, so the feedback never calls those key points missing. */
export function getFeedback(request: { situationId: string; locale: "ar" | "en"; scene: Scene; history: Line[]; met: string[] }, options: Options = {}) {
  return post(FEEDBACK_PATH, request, feedbackSchema, options);
}

export function explainQuote(
  request: { situationId: string; quoteRef: string; locale: "ar" | "en"; mode: "explain" | "simpler" | "question"; question?: string; history?: Turn[] },
  options?: Options,
): Promise<RafiqResult> {
  const history = (request.history ?? []).slice(-HISTORY_TURNS).map((turn) => ({ ...turn, text: turn.text.slice(0, 2000) }));
  return postToRafiq(EXPLAIN_PATH, { ...request, ...(history.length ? { history } : { history: undefined }) }, options);
}

/** A short line naming a scene, so the next practice of this situation is a different one. */
export const sceneSummary = (scene: Scene) => [scene.person, scene.place, scene.mood].filter(Boolean).join(", ").slice(0, 200);
