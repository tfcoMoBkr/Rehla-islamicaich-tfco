import * as z from "zod/mini";

import { deviceStore, textStore } from "@/lib/device-store";
import { chooseCity } from "@/lib/referral/chosen-city";

import { rafiqAnswerSchema, type RafiqResult } from "./answer";
import { forgetLessonThreads } from "./lesson-threads";

/*
 * What Rafiq remembers, all on this device: the name the learner chose to give (optional, never
 * sent to the service), the conversation in each language, the conversations beside lesson boards,
 * and the city chosen for referrals.
 * Nothing is inferred from them, and "Clear everything" removes them all.
 */

export const NAME_MAX_LENGTH = 40;

export const learnerName = textStore("rehla.name.v1");
/** The learner has answered the name prompt once (given a name, or skipped). */
export const nameAsked = textStore("rehla.name.asked.v1");

const resultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("answer"), answer: rafiqAnswerSchema }),
  z.object({ kind: z.literal("rateLimited") }),
  z.object({ kind: z.literal("unavailable") }),
  z.object({ kind: z.literal("error") }),
]);

/** One question and its reply; `at` is when the reply came, in milliseconds since the epoch. */
export const exchangeSchema = z.object({ id: z.int(), at: z.number(), question: z.string(), result: resultSchema });
export type StoredExchange = { id: number; at: number; question: string; result: RafiqResult };

/** When this page was opened: a conversation that began earlier is one the learner returns to. */
export const OPENED_AT = typeof window === "undefined" ? 0 : Date.now();

const conversationSchema = z.array(exchangeSchema);
const conversations = {
  ar: deviceStore<StoredExchange[]>("rehla.rafiq.v1.ar", (raw) => conversationSchema.parse(JSON.parse(raw)), JSON.stringify),
  en: deviceStore<StoredExchange[]>("rehla.rafiq.v1.en", (raw) => conversationSchema.parse(JSON.parse(raw)), JSON.stringify),
};

export function conversationStore(locale: "ar" | "en") {
  return conversations[locale];
}

/** Keeps a reply in the conversation; a retried question keeps its place. */
export function keepExchange(locale: "ar" | "en", exchange: Omit<StoredExchange, "at">): void {
  const kept: StoredExchange = { ...exchange, at: Date.now() };
  const current = conversations[locale].read() ?? [];
  conversations[locale].set(
    current.some((item) => item.id === kept.id) ? current.map((item) => (item.id === kept.id ? kept : item)) : [...current, kept],
  );
}

export function forgetEverything(): void {
  learnerName.set(null);
  nameAsked.set(null);
  conversations.ar.set(null);
  conversations.en.set(null);
  chooseCity(null);
  forgetLessonThreads();
}
