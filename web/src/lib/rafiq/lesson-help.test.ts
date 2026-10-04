import { describe, expect, it } from "vitest";

import { LESSON_HELP_PATH, requestLessonHelp, type LessonHelpRequest } from "./lesson-help";

const request: LessonHelpRequest = {
  lessonId: "1.4",
  cardId: "c1",
  lineText: "Islam is built on five pillars.",
  mode: "simpler",
  locale: "en",
};

const respond = (status: number, body: unknown): typeof fetch => async () =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("requestLessonHelp", () => {
  it("posts the line and its context to the lesson-help endpoint", async () => {
    let sent: { url: string; body: unknown } | null = null;
    const fetcher: typeof fetch = async (url, init) => {
      sent = { url: String(url), body: JSON.parse(String(init?.body)) };
      return new Response(JSON.stringify({ answer: "", sources: [] }));
    };
    await requestLessonHelp(request, { fetcher });
    expect(sent).toEqual({ url: LESSON_HELP_PATH, body: request });
  });

  it("returns an answer only with its sources", async () => {
    const source = { title: "The New Muslim Guide", url: "https://newmuslimguide.com/en" };
    const result = await requestLessonHelp(request, { fetcher: respond(200, { answer: "A simpler line.", sources: [source] }) });
    expect(result).toEqual({ kind: "answer", answer: "A simpler line.", sources: [source] });
  });

  it("turns an answer without sources into a referral", async () => {
    const result = await requestLessonHelp(request, { fetcher: respond(200, { answer: "Unsourced.", sources: [] }) });
    expect(result).toEqual({ kind: "referral" });
  });

  it("reports an error for a failed request or an unexpected reply", async () => {
    expect(await requestLessonHelp(request, { fetcher: respond(404, {}) })).toEqual({ kind: "error" });
    expect(await requestLessonHelp(request, { fetcher: respond(200, { text: "?" }) })).toEqual({ kind: "error" });
    const offline: typeof fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    expect(await requestLessonHelp(request, { fetcher: offline })).toEqual({ kind: "error" });
  });

  it("needs the learner's question in question mode", async () => {
    await expect(requestLessonHelp({ ...request, mode: "question", question: "  " })).rejects.toThrow();
  });
});
