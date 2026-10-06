import * as z from "zod/mini";

import { guardSources, rafiqAnswerSchema } from "@/lib/rafiq/answer";

import { CARDS, type SeenInput } from "./lens";

/*
 * The conversation about a photo: POST /api/ai/lens-turn through this site's proxy. Each message
 * carries the photo's reading, not the photo. When a message is about what can be seen, the
 * service answers "needsImage" and the turn is sent once more with the photo, which stays in this
 * browser for the conversation and is never stored by the service.
 */

export const LENS_TURN_PATH = "/api/ai/lens-turn";
export const LENS_QUESTION_MAX_LENGTH = 500;
/** The service reads at most this many earlier turns. */
export const LENS_HISTORY_TURNS = 8;

const turnResponseSchema = z.object({
  status: z.enum(["answered", "needsImage", "declined"]),
  visual: z.nullish(z.string()),
  answer: z.nullish(rafiqAnswerSchema),
  card: z.nullish(z.enum(CARDS)),
  suggestions: z._default(z.array(z.string()), []),
});

export type TurnResponse = z.infer<typeof turnResponseSchema>;
export type TurnResult = { kind: "turn"; response: TurnResponse } | { kind: "rateLimited" } | { kind: "unavailable" } | { kind: "error" };
export type HistoryTurn = { role: "user" | "assistant"; text: string };

export type TurnRequest = {
  locale: "ar" | "en";
  seen: SeenInput;
  question: string;
  history: HistoryTurn[];
  /** The photo, held in this browser; sent only if the service asks for it. */
  photo?: { base64: string; mimeType: "image/jpeg" };
  reachedLessonIds?: string[];
};

async function post(body: unknown, signal: AbortSignal | undefined, fetcher: typeof fetch): Promise<TurnResult> {
  const response = await fetcher(LENS_TURN_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (response.status === 429) return { kind: "rateLimited" };
  if ([502, 503, 504].includes(response.status)) return { kind: "unavailable" };
  if (!response.ok) return { kind: "error" };
  const parsed = turnResponseSchema.safeParse(await response.json());
  if (!parsed.success) return { kind: "error" };
  const { answer } = parsed.data;
  return { kind: "turn", response: { ...parsed.data, answer: answer ? guardSources(answer) : answer } };
}

export async function askAboutPhoto(
  request: TurnRequest,
  { signal, fetcher = fetch }: { signal?: AbortSignal; fetcher?: typeof fetch } = {},
): Promise<TurnResult> {
  const body = {
    locale: request.locale,
    seen: request.seen,
    question: request.question.trim().slice(0, LENS_QUESTION_MAX_LENGTH),
    history: request.history.slice(-LENS_HISTORY_TURNS).map((turn) => ({ ...turn, text: turn.text.slice(0, 2000) })),
    ...(request.reachedLessonIds?.length ? { reachedLessonIds: request.reachedLessonIds } : {}),
  };
  try {
    const first = await post(body, signal, fetcher);
    if (first.kind !== "turn" || first.response.status !== "needsImage") return first;
    // About what can be seen: once more, with the photo. An example has no photo to send.
    if (!request.photo) return { kind: "turn", response: { ...first.response, status: "answered", visual: null } };
    return await post({ ...body, image: request.photo.base64, mimeType: request.photo.mimeType }, signal, fetcher);
  } catch (error) {
    if (signal?.aborted) throw error;
    return { kind: "unavailable" };
  }
}
