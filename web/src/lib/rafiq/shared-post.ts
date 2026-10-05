import * as z from "zod/mini";

import { deviceStore } from "@/lib/device-store";

/*
 * A Rehla Community post (and, when asked from a reply, that reply) handed to Rafiq as context.
 * It is another member's words: Rafiq reads it as quoted text, never as instructions or a source.
 * It goes from the thread to the Rafiq page through this device's storage, not the address, so
 * the post's text never appears in a link or a request log; it is cleared once the question is
 * sent or the learner removes it.
 */

export const SHARED_TITLE_MAX = 120;
/** Title, body and reply together stay within the length of a question (QUESTION_MAX_LENGTH). */
export const SHARED_MAX_LENGTH = 1000;
const ELLIPSIS = "…";

export const sharedPostSchema = z.object({
  title: z.string().check(z.minLength(1), z.maxLength(SHARED_TITLE_MAX)),
  body: z.string().check(z.maxLength(SHARED_MAX_LENGTH)),
  reply: z.nullable(z.string().check(z.maxLength(SHARED_MAX_LENGTH))),
  shortened: z.boolean(),
});

export type SharedPost = z.infer<typeof sharedPostSchema>;

function cut(text: string, length: number): string {
  return text.length <= length ? text : `${text.slice(0, Math.max(0, length - ELLIPSIS.length)).trimEnd()}${ELLIPSIS}`;
}

/**
 * The post fitted to the limit: the title whole, then the start of the body. A reply keeps at
 * least half of what is left, since it is what the learner asked about.
 */
export function fitSharedPost(post: { title: string; body: string; reply?: string | null }): SharedPost {
  const title = cut(post.title.trim(), SHARED_TITLE_MAX);
  const body = post.body.trim();
  const reply = post.reply?.trim() || null;
  const budget = SHARED_MAX_LENGTH - title.length;
  const replyPart = reply ? cut(reply, Math.max(Math.floor(budget / 2), budget - body.length)) : null;
  const bodyPart = cut(body, budget - (replyPart?.length ?? 0));
  return { title, body: bodyPart, reply: replyPart, shortened: bodyPart !== body || replyPart !== reply };
}

export const sharedPostStore = deviceStore<SharedPost>("rehla.rafiq.shared.v1", (raw) => sharedPostSchema.parse(JSON.parse(raw)), JSON.stringify);

/** What the service receives: the words only. */
export const sharedForRequest = ({ title, body, reply }: SharedPost) => ({ title, body, ...(reply ? { reply } : {}) });
