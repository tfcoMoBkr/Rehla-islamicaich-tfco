import { describe, expect, it } from "vitest";

import { answerText, splitMarkers } from "./answer";
import { askRafiq, ASK_PATH } from "./ask";

describe("splitMarkers", () => {
  it("separates the words from the source markers", () => {
    expect(splitMarkers("Wash the face [1]. Then the feet [2][3].")).toEqual([
      { kind: "text", text: "Wash the face " },
      { kind: "marker", n: 1 },
      { kind: "text", text: ". Then the feet " },
      { kind: "marker", n: 2 },
      { kind: "marker", n: 3 },
      { kind: "text", text: "." },
    ]);
  });
});

describe("answerText", () => {
  it("keeps the words of text blocks only, without markers", () => {
    expect(
      answerText({
        language: "en",
        level: "A",
        referred: false,
        kind: "answer",
        blocks: [
          { type: "text", text: "Tawhid is [1] singling out Allah [1]." },
          { type: "quran", n: 2, ref: "112:1", surah: 112, ayah: 1, arabic: "…", translation: "…", translationKey: "english_saheeh", url: "https://quranenc.com" },
        ],
        sources: [],
        languageFallback: false,
      }),
    ).toBe("Tawhid is singling out Allah.");
  });
});

describe("askRafiq", () => {
  it("sends the trimmed question, the reached lessons and at most eight turns", async () => {
    let body: unknown = null;
    const fetcher: typeof fetch = async (url, init) => {
      expect(String(url)).toBe(ASK_PATH);
      body = JSON.parse(String(init?.body));
      return new Response("{}", { status: 503 });
    };
    const history = Array.from({ length: 10 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", text: `t${index}` }) as const);
    const result = await askRafiq({ question: "  What is wudu? ", locale: "en", reachedLessonIds: ["1.1"], history }, { fetcher });

    expect(result).toEqual({ kind: "unavailable" });
    expect(body).toEqual({ question: "What is wudu?", locale: "en", reachedLessonIds: ["1.1"], history: history.slice(2) });
  });

  it("refuses an empty or overlong question before sending it", () => {
    expect(() => askRafiq({ question: " ", locale: "ar" })).toThrow();
    expect(() => askRafiq({ question: "x".repeat(1001), locale: "ar" })).toThrow();
  });
});
