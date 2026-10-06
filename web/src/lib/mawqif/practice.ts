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
/** A conversation lasts four to six of the learner's replies. */
export const MIN_REPLIES = 4;
export const MAX_REPLIES = 6;

const sceneSchema = z.object({
  person: z._default(z.string(), ""),
  place: z._default(z.string(), ""),
  mood: z._default(z.string(), ""),
  setting: z._default(z.string(), ""),
  line: z._default(z.string(), ""),
});
export type Scene = z.infer<typeof sceneSchema>;

const startSchema = z.object({ status: z.enum(["ready", "unavailable", "unknownSituation"]), scene: z.nullish(sceneSchema) });
const turnSchema = z.object({
  status: z.enum(["continued", "ended", "question", "ruling", "distress", "danger", "unavailable", "unknownSituation"]),
  line: z.nullish(z.string()),
  met: z._default(z.array(z.string()), []),
  tone: z.nullish(z.enum(["fine", "gentler"])),
});
const feedbackSchema = z.object({
  status: z.enum(["ready", "unavailable", "unknownSituation"]),
  replies: z._default(
    z.array(z.object({ n: z.number(), good: z._default(z.string(), ""), missing: z._default(z.array(z.string()), []), better: z._default(z.string(), "") })),
    [],
  ),
});

export type TurnReply = z.infer<typeof turnSchema>;
export type ReplyFeedback = z.infer<typeof feedbackSchema>["replies"][number];
export type Line = { role: "learner" | "character"; text: string };
type Options = { signal?: AbortSignal; fetcher?: typeof fetch };
type Unreachable = { status: "unavailable" } | { status: "rateLimited" };

async function post<T>(path: string, body: unknown, schema: z.ZodMiniType<T>, { signal, fetcher = fetch }: Options): Promise<T | Unreachable> {
  try {
    const response = await fetcher(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
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
