import { beforeEach, describe, expect, it, vi } from "vitest";

import { chooseCity } from "@/lib/referral/chosen-city";

import type { RafiqAnswer } from "./answer";
import { askRafiq } from "./ask";
import { conversationStore, forgetEverything, keepExchange, learnerName, nameAsked } from "./memory";

class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  keys() {
    return [...this.items.keys()];
  }
}

const storage = new MemoryStorage();
vi.stubGlobal("window", { localStorage: storage, addEventListener: () => undefined, removeEventListener: () => undefined });

const chat: RafiqAnswer = {
  kind: "chat",
  language: "en",
  level: null,
  referred: false,
  opening: "Good to hear from you.",
  followUp: null,
  blocks: [],
  sources: [],
  referral: null,
  laterLessonId: null,
  languageFallback: false,
};

beforeEach(() => forgetEverything());

describe("what Rafiq remembers", () => {
  it("keeps each language's conversation apart and restores it", () => {
    keepExchange("en", { id: 1, question: "Hello", result: { kind: "answer", answer: chat } });
    keepExchange("en", { id: 2, question: "Thanks", result: { kind: "error" } });

    expect(conversationStore("en").read()?.map((exchange) => exchange.question)).toEqual(["Hello", "Thanks"]);
    expect(conversationStore("ar").read()).toBeNull();
  });

  it("keeps a retried question in its place", () => {
    keepExchange("en", { id: 1, question: "First", result: { kind: "error" } });
    keepExchange("en", { id: 2, question: "Second", result: { kind: "error" } });
    keepExchange("en", { id: 1, question: "First", result: { kind: "answer", answer: chat } });

    const kept = conversationStore("en").read() ?? [];
    expect(kept.map((exchange) => exchange.id)).toEqual([1, 2]);
    expect(kept[0]?.result.kind).toBe("answer");
  });

  it("forgets a stored conversation it cannot read rather than failing", () => {
    storage.setItem("rehla.rafiq.v1.en", "{not json");
    expect(conversationStore("en").read()).toBeNull();
  });

  it("clears the name, the conversations and the city together", () => {
    learnerName.set("Sam");
    nameAsked.set("yes");
    chooseCity("الرياض");
    keepExchange("ar", { id: 1, question: "السلام عليكم", result: { kind: "error" } });

    forgetEverything();

    expect(storage.keys()).toEqual([]);
    expect(learnerName.read()).toBeNull();
    expect(conversationStore("ar").read()).toBeNull();
  });

  it("never sends the learner's name to the service", async () => {
    learnerName.set("Sam Unique-Name");
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(chat), { status: 200 }));
    await askRafiq({ question: "Hello", locale: "en", history: [{ role: "user", text: "Hi" }] }, { fetcher });

    const body = String(fetcher.mock.calls[0]?.[1]?.body);
    expect(body).not.toContain("Unique-Name");
    expect(Object.keys(JSON.parse(body) as object).sort()).toEqual(["history", "locale", "question"]);
  });
});
