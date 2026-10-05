import { describe, expect, it } from "vitest";

import { askRafiq, QUESTION_MAX_LENGTH } from "./ask";
import { fitSharedPost, SHARED_MAX_LENGTH } from "./shared-post";

const length = ({ title, body, reply }: { title: string; body: string; reply: string | null }) => title.length + body.length + (reply?.length ?? 0);

describe("a community post handed to Rafiq", () => {
  it("stays within the length of a question", () => {
    expect(SHARED_MAX_LENGTH).toBe(QUESTION_MAX_LENGTH);
  });

  it("is kept whole when it fits", () => {
    expect(fitSharedPost({ title: " Lunch at work ", body: "How did you explain it?\n\nThanks." })).toEqual({
      title: "Lunch at work",
      body: "How did you explain it?\n\nThanks.",
      reply: null,
      shortened: false,
    });
  });

  it("keeps the title and the start of a long body, and says it was shortened", () => {
    const fitted = fitSharedPost({ title: "A long one", body: `Start of the post. ${"word ".repeat(400)}` });
    expect(fitted.title).toBe("A long one");
    expect(fitted.body.startsWith("Start of the post.")).toBe(true);
    expect(fitted.body.endsWith("…")).toBe(true);
    expect(fitted.shortened).toBe(true);
    expect(length(fitted)).toBeLessThanOrEqual(SHARED_MAX_LENGTH);
  });

  it("from a reply, keeps at least half the room for the reply", () => {
    const fitted = fitSharedPost({ title: "T", body: "b".repeat(2000), reply: "r".repeat(1000) });
    expect(fitted.reply!.length).toBeGreaterThanOrEqual(Math.floor((SHARED_MAX_LENGTH - 1) / 2));
    expect(fitted.shortened).toBe(true);
    expect(length(fitted)).toBeLessThanOrEqual(SHARED_MAX_LENGTH);
  });

  it("reaches the request with its whole body, and only its words", async () => {
    let sent: Record<string, unknown> = {};
    const fetcher: typeof fetch = async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return new Response("{}", { status: 503 });
    };
    const body = "How did you explain it to your colleagues?\n\nI am not sure where to start.";
    const shared = fitSharedPost({ title: "Lunch at work", body, reply: "Keep it short." });
    await askRafiq({ question: "Can you help me understand this post?", locale: "en", shared }, { fetcher });

    expect(sent.shared).toEqual({ title: "Lunch at work", body, reply: "Keep it short." });
    expect(sent.question).toBe("Can you help me understand this post?");

    await askRafiq({ question: "What is wudu?", locale: "en" }, { fetcher });
    expect(sent).not.toHaveProperty("shared");
  });
});
