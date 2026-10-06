import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RafiqAnswer, RafiqResult } from "./answer";

class MemoryStorage {
  items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

const storage = new MemoryStorage();
vi.stubGlobal("window", { localStorage: storage, addEventListener: () => undefined, removeEventListener: () => undefined });

const LESSON = "2.4";
const LINE = { cardId: "c3", line: "Making niyyah (intention) in the heart." };

const answer = (text: string): RafiqAnswer => ({
  language: "en",
  level: "A",
  referred: false,
  kind: "answer",
  opening: null,
  followUp: null,
  blocks: [{ type: "text", role: "answer", text: `${text} [1]` }],
  sources: [{ n: 1, sourceId: "mukhtasar", title: "Book", reference: "Wudu", url: "https://byenah.com/en", publisher: "byenah.com" }],
  referral: null,
  laterLessonId: null,
  languageFallback: false,
});
const textOf = (result: RafiqResult) => (result.kind === "answer" ? result.answer.blocks.map((block) => (block.type === "text" ? block.text : "")).join(" ") : "");

/** A fake /lesson-help: records every body it is sent and answers in turn. */
function fakeEndpoint(...replies: string[]) {
  const bodies: Record<string, unknown>[] = [];
  const fetcher: typeof fetch = async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(JSON.stringify(answer(replies[bodies.length - 1] ?? "More")), { status: 200 });
  };
  return { bodies, fetcher };
}

/** The modules as a page opened afresh would load them, with only the device storage carried over. */
async function freshPage() {
  vi.resetModules();
  return {
    conversation: await import("./lesson-conversation"),
    threads: await import("./lesson-threads"),
    memory: await import("./memory"),
  };
}

beforeEach(() => storage.items.clear());

describe("the conversation beside a lesson board", () => {
  it("opens on a new line with Rafiq explaining it, and goes on with the thread as its history", async () => {
    const { conversation, threads } = await freshPage();
    const { bodies, fetcher } = fakeEndpoint("It is the resolve in the heart", "Simpler: you mean to do it");
    const options = { locale: "en" as const, reachedLessonIds: ["2.3"], replyText: textOf, fetcher };

    const first = conversation.openingExchange(LESSON, LINE);
    expect(first?.mode).toBe("explain");
    await conversation.sendLessonExchange(LESSON, first!, options);
    await conversation.sendLessonExchange(LESSON, conversation.newExchange(LESSON, LINE, "simpler", "Simpler"), options);

    expect(bodies[0]).toMatchObject({ lessonId: LESSON, cardId: "c3", lineText: LINE.line, mode: "explain", history: [], reachedLessonIds: ["2.3"] });
    expect(bodies[1]).toMatchObject({ mode: "simpler" });
    expect(bodies[1]?.history).toEqual([
      { role: "user", text: LINE.line },
      { role: "assistant", text: "It is the resolve in the heart [1]" },
    ]);
    expect(threads.readLessonThread(LESSON).map((item) => item.mode)).toEqual(["explain", "simpler"]);
  });

  it("restores the thread when the learner comes back, without asking again about the same line", async () => {
    const before = await freshPage();
    const { fetcher } = fakeEndpoint("It is the resolve in the heart");
    await before.conversation.sendLessonExchange(LESSON, before.conversation.openingExchange(LESSON, LINE)!, {
      locale: "en",
      reachedLessonIds: [],
      replyText: textOf,
      fetcher,
    });

    const after = await freshPage();
    expect(after.threads.readLessonThread(LESSON)).toHaveLength(1);
    expect(after.conversation.openingExchange(LESSON, LINE)).toBeNull();
    expect(after.conversation.openingExchange(LESSON, { cardId: "c4", line: "Another line." })?.mode).toBe("explain");
    expect(after.threads.readLessonThread("3.4")).toEqual([]);
  });

  it("keeps nothing when the learner closes the panel before the reply", async () => {
    const { conversation, threads } = await freshPage();
    const controller = new AbortController();
    const fetcher: typeof fetch = async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    };
    const result = await conversation.sendLessonExchange(LESSON, conversation.openingExchange(LESSON, LINE)!, {
      locale: "en",
      reachedLessonIds: [],
      replyText: textOf,
      signal: controller.signal,
      fetcher,
    });
    expect(result).toBeNull();
    expect(threads.readLessonThread(LESSON)).toEqual([]);
  });

  it("is cleared with everything else Rafiq remembers", async () => {
    const { conversation, threads, memory } = await freshPage();
    const { fetcher } = fakeEndpoint("Reply");
    await conversation.sendLessonExchange(LESSON, conversation.openingExchange(LESSON, LINE)!, { locale: "en", reachedLessonIds: [], replyText: textOf, fetcher });
    memory.forgetEverything();
    expect(threads.readLessonThread(LESSON)).toEqual([]);
    expect(storage.items.size).toBe(0);
  });
});
