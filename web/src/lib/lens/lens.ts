import * as z from "zod/mini";

import { guardSources, rafiqAnswerSchema } from "@/lib/rafiq/answer";

/*
 * The client for Lens: POST /api/ai/lens through this site's proxy. The service reads the photo
 * (SEE), applies the decision table in code (DECIDE) and, for the rows that answer, asks Rafiq
 * (EXPLAIN); its answer is an ordinary Rafiq answer, rendered with the same components.
 */

export const LENS_PATH = "/api/ai/lens";

export const CARDS = ["person", "unclear", "privacy", "unsafe", "unmatched", "nothing", "timeout"] as const;
export type LensCard = (typeof CARDS)[number];

const seenSchema = z.object({
  kind: z.enum(["text", "object", "place", "document", "person", "unsafe", "unclear"]),
  subject: z._default(z.string(), ""),
  visibleText: z.nullish(z.object({ text: z.string(), language: z.string() })),
  plainTranslation: z.nullish(z.string()),
  looksLikeScripture: z._default(z.boolean(), false),
  peoplePresent: z._default(z.boolean(), false),
  confidence: z.number(),
  category: z._default(z.string(), "ordinary"),
  quality: z._default(z.string(), "good"),
  religiousTerms: z._default(z.array(z.string()), []),
  others: z._default(z.array(z.string()), []),
});

export type Seen = z.infer<typeof seenSchema>;
/** What a request may carry in place of a photo: an example, or a subject the learner chose. */
export type SeenInput = z.input<typeof seenSchema>;

export const lensResponseSchema = z.object({
  seen: z.nullable(seenSchema),
  row: z.number(),
  answer: z.nullish(rafiqAnswerSchema),
  card: z.nullish(z.enum(CARDS)),
  others: z._default(z.array(z.string()), []),
});

export type LensResponse = z.infer<typeof lensResponseSchema>;

export type LensResult =
  | { kind: "result"; response: LensResponse }
  | { kind: "rateLimited" }
  | { kind: "unavailable" }
  | { kind: "tooLarge" }
  | { kind: "badType" }
  | { kind: "error" };

export type LensRequest = {
  locale: "ar" | "en";
  photo?: { base64: string; mimeType: "image/jpeg" };
  seen?: SeenInput;
  reachedLessonIds?: string[];
};

export async function readLens(
  request: LensRequest,
  { signal, fetcher = fetch }: { signal?: AbortSignal; fetcher?: typeof fetch } = {},
): Promise<LensResult> {
  const body = {
    locale: request.locale,
    ...(request.photo ? { image: request.photo.base64, mimeType: request.photo.mimeType } : {}),
    ...(request.seen ? { seen: request.seen } : {}),
    ...(request.reachedLessonIds?.length ? { reachedLessonIds: request.reachedLessonIds } : {}),
  };
  try {
    const response = await fetcher(LENS_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (response.status === 429) return { kind: "rateLimited" };
    if (response.status === 413) return { kind: "tooLarge" };
    if ([502, 503, 504].includes(response.status)) return { kind: "unavailable" };
    if (response.status === 422) {
      const error = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
      return error?.error?.code === "image_type" ? { kind: "badType" } : { kind: "error" };
    }
    if (!response.ok) return { kind: "error" };
    const parsed = lensResponseSchema.safeParse(await response.json());
    if (!parsed.success) return { kind: "error" };
    const { answer } = parsed.data;
    return { kind: "result", response: { ...parsed.data, answer: answer ? guardSources(answer) : answer } };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { kind: "unavailable" };
  }
}

/** Rows whose result is ordinary text with a machine translation, never scripture. */
export const TEXT_ROWS = new Set([3, 13, 15]);
