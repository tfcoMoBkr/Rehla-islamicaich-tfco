import { z } from "zod";

import { ANSWER_LANGUAGES } from "./languages";

/*
 * Rafiq's answer as the AI service returns it (ai/app/rafiq/schemas.py, RafiqAnswer), and the one
 * way the browser asks for it: through the same-origin /api/ai/* rewrite. Verses and hadiths arrive
 * as their own blocks, exactly as their publishers print them (never retyped, trimmed or
 * normalised on the way); text blocks carry [n] markers that point to the numbered sources.
 */

export const REFERRAL_REASONS = [
  "fatwa",
  "personalCase",
  "disputed",
  "noSource",
  "noEvidence",
  "verification",
  "distress",
  "danger",
  "offTopic",
  "smalltalk",
] as const;
export type ReferralReason = (typeof REFERRAL_REASONS)[number];

/** Referrals that end with the specialist card (ai/app/rafiq/policy.py, SPECIALIST_REASONS). */
export const SPECIALIST_REASONS: ReadonlySet<ReferralReason> = new Set([
  "fatwa",
  "personalCase",
  "disputed",
  "noSource",
  "noEvidence",
  "verification",
  "distress",
  "danger",
]);

/** How the page lays a reply out: a cited answer, a referral, a chat line, a question back, or danger. */
export const REPLY_KINDS = ["answer", "referral", "chat", "clarify", "danger"] as const;

const textBlockSchema = z.object({ type: z.literal("text"), text: z.string() });

const answerLanguageSchema = z.enum(ANSWER_LANGUAGES);

const quranBlockSchema = z.object({
  type: z.literal("quran"),
  n: z.number().int().positive(),
  /** surah:ayah */
  ref: z.string().min(1),
  surah: z.number().int().positive(),
  ayah: z.number().int().positive(),
  /** The surah's name in the answer's language, as mp3quran.net publishes it. */
  surahName: z.string().nullish(),
  arabic: z.string().min(1),
  translation: z.string().nullish(),
  /** The translation's own language: it differs from the answer's when none is published in it. */
  translationLanguage: answerLanguageSchema.nullish(),
  /** The QuranEnc translation it is taken from, such as english_saheeh, with its name and version. */
  translationKey: z.string().nullish(),
  translationName: z.string().nullish(),
  translationVersion: z.string().nullish(),
  url: z.url(),
});

const hadithBlockSchema = z.object({
  type: z.literal("hadith"),
  n: z.number().int().positive(),
  id: z.number().int(),
  title: z.string(),
  arabic: z.string().min(1),
  /** The published translation (absent when the answer is in Arabic). */
  text: z.string().nullish(),
  textLanguage: answerLanguageSchema.nullish(),
  grade: z.string(),
  attribution: z.string(),
  /** HadeethEnc's own explanation, shown with extractive answers. */
  explanation: z.string().nullish(),
  url: z.url(),
});

const sourceCardSchema = z.object({
  n: z.number().int().positive(),
  /** The source's entry in content/sources.json, shown on the sources page. */
  sourceId: z.string().min(1),
  title: z.string().min(1),
  reference: z.string(),
  url: z.url(),
  publisher: z.string(),
});

export const rafiqAnswerSchema = z.object({
  language: answerLanguageSchema,
  level: z.enum(["A", "B", "C", "D"]).nullable(),
  referred: z.boolean(),
  kind: z.enum(REPLY_KINDS).default("answer"),
  /** Warm lines around the cited answer, checked by the service to carry no religious statement. */
  opening: z.string().nullish(),
  blocks: z.array(z.discriminatedUnion("type", [textBlockSchema, quranBlockSchema, hadithBlockSchema])),
  sources: z.array(sourceCardSchema),
  followUp: z.string().nullish(),
  referral: z
    .object({
      reason: z.enum(REFERRAL_REASONS),
      links: z.array(z.string()),
      /** Referral bodies to show, by id in content/referral-centers.json. */
      centers: z.array(z.string()).default([]),
    })
    .nullish(),
  /** A lesson further along the learner's road that covers the question. */
  laterLessonId: z.string().nullish(),
  /** The question was in a language Rafiq does not answer in; the answer is in `language`. */
  languageFallback: z.boolean().default(false),
});

export type RafiqAnswer = z.infer<typeof rafiqAnswerSchema>;
export type AnswerBlock = RafiqAnswer["blocks"][number];
export type SourceCard = RafiqAnswer["sources"][number];
export type QuranAnswerBlock = Extract<AnswerBlock, { type: "quran" }>;
export type HadithAnswerBlock = Extract<AnswerBlock, { type: "hadith" }>;

export type RafiqResult =
  | { kind: "answer"; answer: RafiqAnswer }
  | { kind: "rateLimited" }
  | { kind: "unavailable" }
  | { kind: "error" };

const UNAVAILABLE_STATUSES = new Set([502, 503, 504]);

/**
 * A reply that would show religious text without a source is turned into a referral here as
 * well as in the service: no source, no statement.
 */
export function guardSources(answer: RafiqAnswer): RafiqAnswer {
  const religious = answer.blocks.some((block) => block.type !== "text" || block.text.trim().length > 0);
  if (!religious || answer.sources.length > 0) return answer;
  if (answer.referral?.reason === "smalltalk") return answer;
  return {
    ...answer,
    referred: true,
    kind: "referral",
    blocks: [],
    referral: { reason: "noSource", links: ["/talk-to-a-specialist"], centers: [] },
  };
}

export async function postToRafiq(
  path: string,
  body: unknown,
  { signal, fetcher = fetch }: { signal?: AbortSignal; fetcher?: typeof fetch } = {},
): Promise<RafiqResult> {
  try {
    const response = await fetcher(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (response.status === 429) return { kind: "rateLimited" };
    if (UNAVAILABLE_STATUSES.has(response.status)) return { kind: "unavailable" };
    if (!response.ok) return { kind: "error" };
    const parsed = rafiqAnswerSchema.safeParse(await response.json());
    if (!parsed.success) return { kind: "error" };
    return { kind: "answer", answer: guardSources(parsed.data) };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { kind: "unavailable" };
  }
}

/** The plain words of an answer, markers removed: what is sent back as conversation history. */
export function answerText(answer: RafiqAnswer): string {
  return answer.blocks
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n")
    .replace(/\s*\[\d+\]/g, "")
    .trim();
}

/** Everything Rafiq said in a reply, as the conversation's history carries it back to him. */
export function replyText(answer: RafiqAnswer): string {
  return [answer.opening, answerText(answer), answer.followUp].filter(Boolean).join("\n");
}

export type TextPart = { kind: "text"; text: string } | { kind: "marker"; n: number };

/** Splits a text block at its [n] markers. */
export function splitMarkers(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(/\[(\d+)\]/g)) {
    if (match.index > last) parts.push({ kind: "text", text: text.slice(last, match.index) });
    parts.push({ kind: "marker", n: Number(match[1]) });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}
