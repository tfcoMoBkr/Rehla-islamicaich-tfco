// zod/mini: the same checks as zod, small enough for every page that talks to Rafiq.
import * as z from "zod/mini";

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
  "unexplained",
  "verseNotFound",
  "hadithNotFound",
  "timeout",
  "dailyCap",
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
  "unexplained",
  "verseNotFound",
  "hadithNotFound",
]);

/** How the page lays a reply out: a cited answer, a referral, a chat line, a question back, or danger. */
export const REPLY_KINDS = ["answer", "referral", "chat", "clarify", "danger"] as const;

/** Rafiq's own words: the direct answer, or the explanation shown after the sources. */
const textBlockSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
  role: z._default(z.enum(["answer", "explanation"]), "answer"),
});

const answerLanguageSchema = z.enum(ANSWER_LANGUAGES);
const counter = z.int().check(z.positive());
const filled = z.string().check(z.minLength(1));
const optionalText = z.nullish(z.string());

const quranBlockSchema = z.object({
  type: z.literal("quran"),
  n: counter,
  /** surah:ayah */
  ref: filled,
  surah: counter,
  ayah: counter,
  /** The surah's name in the answer's language, as mp3quran.net publishes it. */
  surahName: optionalText,
  arabic: filled,
  translation: optionalText,
  /** The translation's own language: it differs from the answer's when none is published in it. */
  translationLanguage: z.nullish(answerLanguageSchema),
  /** The QuranEnc translation it is taken from, such as english_saheeh, with its name and version. */
  translationKey: optionalText,
  translationName: optionalText,
  translationVersion: optionalText,
  url: z.url(),
});

const hadithBlockSchema = z.object({
  type: z.literal("hadith"),
  n: counter,
  id: z.int(),
  title: z.string(),
  arabic: filled,
  /** The published translation (absent when the answer is in Arabic). */
  text: optionalText,
  textLanguage: z.nullish(answerLanguageSchema),
  grade: z.string(),
  attribution: z.string(),
  /** HadeethEnc's own explanation, shown with extractive answers. */
  explanation: optionalText,
  url: z.url(),
});

/**
 * A term translated from the organisers' glossary: its approved equivalent and usage rule, then
 * TerminologyEnc's definition when the corpus has it, each exactly as its source gives it.
 */
const termBlockSchema = z.object({
  type: z.literal("term"),
  n: counter,
  term: filled,
  approved: filled,
  rule: filled,
  definition: optionalText,
  definitionLanguage: z.nullish(answerLanguageSchema),
  definitionN: z.nullish(counter),
});

/** A book passage exactly as the corpus holds it, labelled with its own language. */
const bookBlockSchema = z.object({
  type: z.literal("book"),
  n: counter,
  title: filled,
  reference: z.string(),
  text: filled,
  language: answerLanguageSchema,
  url: z.url(),
});

/** A fixed line the page writes in its own language about the text before it. */
const noteBlockSchema = z.object({
  type: z.literal("note"),
  note: z.enum(["gradeNotStated", "wordingDiffers", "notARuling"]),
});

const sourceCardSchema = z.object({
  n: counter,
  /** The source's entry in content/sources.json, shown on the sources page. */
  sourceId: filled,
  title: filled,
  reference: z.string(),
  /** Empty for a source with no public address: its entry on the sources page stands for it. */
  url: z.union([z.url(), z.literal("")]),
  publisher: z.string(),
});

export const rafiqAnswerSchema = z.object({
  language: answerLanguageSchema,
  level: z.nullable(z.enum(["A", "B", "C", "D"])),
  referred: z.boolean(),
  kind: z._default(z.enum(REPLY_KINDS), "answer"),
  /** Warm lines around the cited answer, checked by the service to carry no religious statement. */
  opening: optionalText,
  blocks: z.array(z.discriminatedUnion("type", [textBlockSchema, quranBlockSchema, hadithBlockSchema, termBlockSchema, bookBlockSchema, noteBlockSchema])),
  sources: z.array(sourceCardSchema),
  followUp: optionalText,
  /** A line about the learner's effort, after the sources: checked to carry no religious claim. */
  encouragement: optionalText,
  referral: z.nullish(
    z.object({
      reason: z.enum(REFERRAL_REASONS),
      links: z.array(z.string()),
      /** Referral bodies to show, by id in content/referral-centers.json. */
      centers: z._default(z.array(z.string()), []),
      /** "outside": the learner said they live outside Saudi Arabia; the card leads with that. */
      region: z.nullish(z.literal("outside")),
    }),
  ),
  /** A lesson further along the learner's road that covers the question. */
  laterLessonId: optionalText,
  /** On a card for want of a source: the lessons that cover the topic. */
  topicLessonIds: z.optional(z.array(z.string())),
  /** The question was in a language Rafiq does not answer in; the answer is in `language`. */
  languageFallback: z._default(z.boolean(), false),
});

export type RafiqAnswer = z.infer<typeof rafiqAnswerSchema>;
export type AnswerBlock = RafiqAnswer["blocks"][number];
export type SourceCard = RafiqAnswer["sources"][number];
export type QuranAnswerBlock = Extract<AnswerBlock, { type: "quran" }>;
export type HadithAnswerBlock = Extract<AnswerBlock, { type: "hadith" }>;
export type TermAnswerBlock = Extract<AnswerBlock, { type: "term" }>;
export type BookAnswerBlock = Extract<AnswerBlock, { type: "book" }>;

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
    .map((block) => (block.type === "text" ? block.text : block.type === "term" ? `${block.term}: ${block.approved}` : ""))
    .join("\n")
    .replace(/\s*\[\d+\]/g, "")
    .trim();
}

/** Everything Rafiq said in a reply, as the conversation's history carries it back to him. */
export function replyText(answer: RafiqAnswer): string {
  return [answer.opening, answerText(answer), answer.encouragement, answer.followUp].filter(Boolean).join("\n");
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
