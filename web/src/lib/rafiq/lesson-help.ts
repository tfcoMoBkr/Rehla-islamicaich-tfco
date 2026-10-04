import type { Locale } from "next-intl";
import { z } from "zod";

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

const lessonHelpResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(
    z.object({
      title: z.string().min(1),
      url: z.url(),
      /** An exact reference such as surah:ayah or a hadith number. */
      reference: z.string().optional(),
    }),
  ),
  /** The service chose to refer the learner to a person instead of answering. */
  referral: z.boolean().default(false),
});

export type LessonHelpSource = z.infer<typeof lessonHelpResponseSchema>["sources"][number];

export type LessonHelpResult =
  | { kind: "answer"; answer: string; sources: LessonHelpSource[] }
  | { kind: "referral" }
  | { kind: "error" };

export const LESSON_HELP_PATH = "/api/ai/lesson-help";

export async function requestLessonHelp(
  request: LessonHelpRequest,
  { signal, fetcher = fetch }: { signal?: AbortSignal; fetcher?: typeof fetch } = {},
): Promise<LessonHelpResult> {
  if (request.mode === "question" && !request.question?.trim()) {
    throw new Error("A question is required in question mode");
  }
  try {
    const response = await fetcher(LESSON_HELP_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
    if (!response.ok) return { kind: "error" };
    const parsed = lessonHelpResponseSchema.safeParse(await response.json());
    if (!parsed.success) return { kind: "error" };
    const { answer, sources, referral } = parsed.data;
    // An answer without sources is never shown as a religious answer; it becomes a referral.
    if (referral || sources.length === 0 || !answer.trim()) return { kind: "referral" };
    return { kind: "answer", answer, sources };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { kind: "error" };
  }
}
