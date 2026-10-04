import { describe, expect, it } from "vitest";

import type { RafiqAnswer } from "./answer";
import { LESSON_HELP_PATH, requestLessonHelp, type LessonHelpRequest } from "./lesson-help";

const request: LessonHelpRequest = {
  lessonId: "1.4",
  cardId: "c1",
  lineText: "Islam is built on five pillars.",
  mode: "simpler",
  locale: "en",
};

const source = {
  n: 1,
  sourceId: "byenah-new-muslim-guideline",
  title: "New Muslim Guideline",
  reference: "Pillars",
  url: "https://byenah.com/en",
  publisher: "byenah.com",
};

const answered: RafiqAnswer = {
  language: "en",
  level: "B",
  referred: false,
  kind: "answer",
  blocks: [{ type: "text", text: "A simpler line [1]." }],
  sources: [source],
  referral: null,
  languageFallback: false,
};

const respond = (status: number, body: unknown): typeof fetch => async () =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("requestLessonHelp", () => {
  it("posts the line and its context to the lesson-help endpoint", async () => {
    let sent: { url: string; body: unknown } | null = null;
    const fetcher: typeof fetch = async (url, init) => {
      sent = { url: String(url), body: JSON.parse(String(init?.body)) };
      return new Response(JSON.stringify(answered));
    };
    await requestLessonHelp(request, { fetcher });
    expect(sent).toEqual({ url: LESSON_HELP_PATH, body: request });
  });

  it("returns an answer with its sources", async () => {
    const result = await requestLessonHelp(request, { fetcher: respond(200, answered) });
    expect(result).toEqual({ kind: "answer", answer: answered });
  });

  it("turns an answer without sources into a referral", async () => {
    const result = await requestLessonHelp(request, { fetcher: respond(200, { ...answered, sources: [] }) });
    expect(result.kind === "answer" && result.answer.referral?.reason).toBe("noSource");
    expect(result.kind === "answer" && result.answer.blocks).toEqual([]);
  });

  it("tells a busy or absent service from a failed request", async () => {
    expect(await requestLessonHelp(request, { fetcher: respond(429, { error: { code: "rate_limited" } }) })).toEqual({ kind: "rateLimited" });
    expect(await requestLessonHelp(request, { fetcher: respond(503, { error: { code: "unavailable" } }) })).toEqual({ kind: "unavailable" });
    expect(await requestLessonHelp(request, { fetcher: respond(404, {}) })).toEqual({ kind: "error" });
    expect(await requestLessonHelp(request, { fetcher: respond(200, { text: "?" }) })).toEqual({ kind: "error" });
    const offline: typeof fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    expect(await requestLessonHelp(request, { fetcher: offline })).toEqual({ kind: "unavailable" });
  });

  it("needs the learner's question in question mode", () => {
    expect(() => requestLessonHelp({ ...request, mode: "question", question: "  " })).toThrow();
  });
});
