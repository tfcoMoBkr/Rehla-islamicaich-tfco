import * as z from "zod/mini";

import messages from "../../../messages/answer-languages.json";
import { REFERRAL_REASONS } from "./answer";
import type { AnswerLanguage } from "./languages";

/*
 * What Rafiq says in the answer's own language when that is not the page's (Urdu, Bengali,
 * French): the disclosure, the small-talk reply, the warm lines around an answer, the question
 * back, and each referral. These are fixed lines: in these languages the model writes none.
 * Interface labels stay in the page's locale. The texts await native review (messages/answer-languages.json).
 */

const filled = z.string().check(z.minLength(1));
const card = z.object({ title: filled, body: filled });
const referralReasons = REFERRAL_REASONS.filter((reason) => reason !== "smalltalk");

const answerMessagesSchema = z.object({
  disclosure: filled,
  smalltalk: filled,
  /** The fixed warm lines around a cited answer, and the question back when a follow-up is unclear. */
  opening: filled,
  followUp: filled,
  clarify: filled,
  referral: z.object(Object.fromEntries(referralReasons.map((reason) => [reason, card])) as Record<(typeof referralReasons)[number], typeof card>),
});

export type AnswerMessages = z.infer<typeof answerMessagesSchema>;

const byLanguage = z.record(z.string(), answerMessagesSchema).parse(
  Object.fromEntries(Object.entries(messages).filter(([key]) => !key.startsWith("_"))),
);

/** The messages for an answer in `language`, or null when the page's own messages apply. */
export function answerMessages(language: AnswerLanguage): AnswerMessages | null {
  return byLanguage[language] ?? null;
}
