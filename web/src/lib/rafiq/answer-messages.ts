import { z } from "zod";

import messages from "../../../messages/answer-languages.json";
import { REFERRAL_REASONS } from "./answer";
import type { AnswerLanguage } from "./languages";

/*
 * What Rafiq says in the answer's own language when that is not the page's (Urdu, Bengali,
 * French): the disclosure, the small-talk reply and each referral. Interface labels stay in the
 * page's locale. The texts await native review (messages/answer-languages.json).
 */

const card = z.object({ title: z.string().min(1), body: z.string().min(1) });
const referralReasons = REFERRAL_REASONS.filter((reason) => reason !== "smalltalk");

const answerMessagesSchema = z.object({
  disclosure: z.string().min(1),
  smalltalk: z.string().min(1),
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
