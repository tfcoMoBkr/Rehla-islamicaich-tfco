import * as z from "zod/mini";

/*
 * A reply the learner wrote in a role-play, judged by the AI service against the turn's key points
 * only (POST /api/ai/mawqif-evaluate). The learner's name is never sent. The page builds the
 * feedback itself from fixed lines and the quoted sources of the key points.
 */

export const EVALUATE_PATH = "/api/ai/mawqif-evaluate";
export const REPLY_MAX_LENGTH = 500;

const evaluationSchema = z.object({
  status: z.enum(["evaluated", "question", "distress", "danger", "unavailable", "unknownTurn"]),
  met: z._default(z.array(z.string()), []),
  missing: z._default(z.array(z.string()), []),
  tone: z.nullish(z.enum(["fine", "gentler"])),
  encouragement: z.nullish(z.string()),
});

export type Evaluation = z.infer<typeof evaluationSchema>;

export type EvaluateRequest = { situationId: string; turnId: string; reply: string; locale: "ar" | "en" };

/** The evaluation, or "unavailable" when it cannot be had: the turn then falls back to the written choices. */
export async function evaluateReply(
  request: EvaluateRequest,
  { signal, fetcher = fetch }: { signal?: AbortSignal; fetcher?: typeof fetch } = {},
): Promise<Evaluation | { status: "unavailable" } | { status: "rateLimited" }> {
  const body: EvaluateRequest = { ...request, reply: request.reply.trim().slice(0, REPLY_MAX_LENGTH) };
  try {
    const response = await fetcher(EVALUATE_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (response.status === 429) return { status: "rateLimited" };
    if (!response.ok) return { status: "unavailable" };
    const parsed = evaluationSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : { status: "unavailable" };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { status: "unavailable" };
  }
}
