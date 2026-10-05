import { z } from "zod";

import { bilingual, evidenceSchema, excerptRefSchema } from "./schema";

/*
 * A Mawqif situation (content/situations/*.json). Every religious item in it is a quote: an exact
 * excerpt, in each language, of a stored source the situation lists (a HadeethEnc hadith, a
 * QuranEnc verse, or an approved book by textRef). Team wording is allowed only for the story
 * frame, the other person's ordinary lines, the framing of replies and the check questions.
 * situation-content.test.ts checks every quote against the stored text, byte for byte.
 */

const nonEmpty = z.object({ ar: z.string().min(1), en: z.string().min(1) });

export const quoteSchema = z.object({ ref: z.string(), ar: z.string().min(1), en: z.string().min(1) });
export type Quote = z.infer<typeof quoteSchema>;

const part = z.union([z.object({ text: nonEmpty }).strict(), z.object({ quote: quoteSchema }).strict()]);

const itemSchema = z.discriminatedUnion("type", [
  evidenceSchema.options[0].extend({ id: z.string() }),
  evidenceSchema.options[1].extend({ id: z.string(), hadeethencId: z.number().int() }),
  z.object({
    id: z.string(),
    type: z.literal("book"),
    source: z.string(),
    textRef: z.object({ ar: excerptRefSchema, en: excerptRefSchema }),
  }),
]);
export type SituationItem = z.infer<typeof itemSchema>;

const choiceSchema = z.object({
  id: z.string(),
  quality: z.enum(["best", "acceptable", "avoid"]),
  reply: z.array(part).min(1),
  meets: z.array(z.string()),
});

const exchangeSchema = z
  .object({
    id: z.string(),
    says: z.array(part).min(1),
    keyPoints: z.array(z.object({ id: z.string(), quote: quoteSchema })).min(1),
    choices: z.array(choiceSchema).length(3),
  })
  .superRefine((exchange, context) => {
    const qualities = exchange.choices.map((choice) => choice.quality).sort();
    if (qualities.join() !== "acceptable,avoid,best") context.addIssue({ code: "custom", message: `${exchange.id}: one best, one acceptable and one to avoid` });
    const points = new Set(exchange.keyPoints.map((point) => point.id));
    const meets = (quality: string) => exchange.choices.find((choice) => choice.quality === quality)?.meets ?? [];
    for (const choice of exchange.choices) {
      for (const met of choice.meets) if (!points.has(met)) context.addIssue({ code: "custom", message: `${exchange.id}/${choice.id}: unknown key point ${met}` });
    }
    if (meets("best").length !== points.size) context.addIssue({ code: "custom", message: `${exchange.id}: the best reply meets every key point` });
    if (meets("acceptable").length >= points.size) context.addIssue({ code: "custom", message: `${exchange.id}: the acceptable reply misses something` });
    if (meets("avoid").length > 0) context.addIssue({ code: "custom", message: `${exchange.id}: the reply to avoid meets nothing` });
  });

const checkSchema = z
  .object({
    id: z.string(),
    prompt: nonEmpty,
    options: z
      .array(z.union([z.object({ quote: quoteSchema, correct: z.boolean() }), z.object({ text: nonEmpty, correct: z.boolean() })]))
      .min(2),
  })
  .superRefine((check, context) => {
    const correct = check.options.filter((option) => option.correct);
    // The right answer is always the source's own words.
    if (correct.length !== 1 || !("quote" in correct[0]!)) context.addIssue({ code: "custom", message: `${check.id}: exactly one correct option, quoted from a source` });
  });

export const situationSchema = z
  .object({
    id: z.string().regex(/^[a-z]+$/),
    order: z.number().int().positive(),
    status: z.enum(["published", "draft"]),
    reviewed: z.boolean(),
    art: z.string(),
    title: nonEmpty,
    scene: nonEmpty,
    character: nonEmpty,
    learn: z.object({ say: z.array(quoteSchema).min(1), why: z.array(quoteSchema).min(1), when: z.array(quoteSchema).min(1) }),
    exchanges: z.array(exchangeSchema).min(2).max(4),
    check: z.array(checkSchema).min(2).max(3),
    relatedLessons: z.array(z.string()),
    sources: z.array(z.object({ key: z.string(), title: bilingual, publisher: z.string(), url: bilingual, use: z.string() })),
    items: z.array(itemSchema).min(1),
  })
  .superRefine((situation, context) => {
    const items = new Set(situation.items.map((item) => item.id));
    const visit = (value: unknown) => {
      if (Array.isArray(value)) return value.forEach(visit);
      if (!value || typeof value !== "object") return;
      const record = value as Record<string, unknown>;
      if (typeof record.ref === "string" && typeof record.ar === "string" && !items.has(record.ref)) {
        context.addIssue({ code: "custom", message: `${situation.id}: quote points to ${record.ref}, which the situation does not list` });
      }
      Object.values(record).forEach(visit);
    };
    visit(situation);
    const books = new Set(situation.sources.map((source) => source.key));
    for (const item of situation.items) {
      if (item.type === "book" && !books.has(item.source)) context.addIssue({ code: "custom", message: `${situation.id}: ${item.id} names ${item.source}, not in sources` });
    }
  });

export type Situation = z.infer<typeof situationSchema>;
