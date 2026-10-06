import { describe, expect, it } from "vitest";

import { loadKhutuwat, loadSituations } from "@/lib/content/load";
import { toSituationView } from "@/lib/content/situation-view";
import { EMPTY_PROGRESS, withBestRound } from "@/lib/learn/progress";

import { analyseConversations, keyPointsOf, testSituations } from "./conversation";
import { getFeedback, sceneSummary, startScene, takeTurn, TURN_PATH } from "./practice";
import { conversationKey, situationStatus } from "./progress";
import type { SituationStop } from "./types";

const scene = { person: "Mariam", place: "the lift", mood: "cheerful", setting: "You step in.", line: "Hi!" };
const reply = (status: number, body: unknown): typeof fetch => async () => new Response(JSON.stringify(body), { status });

describe("the practice client", () => {
  it("starts a scene, takes a turn and asks for feedback, and says when the service cannot be reached", async () => {
    expect(await startScene({ situationId: "greeting", locale: "en", avoid: [] }, { fetcher: reply(200, { status: "ready", scene }) })).toEqual({ status: "ready", scene });
    let sent: Record<string, unknown> = {};
    const fetcher: typeof fetch = async (url, init) => {
      expect(String(url)).toBe(TURN_PATH);
      sent = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ status: "continued", line: "Nice!", met: ["k1"] }));
    };
    const turn = await takeTurn({ situationId: "greeting", locale: "en", scene, history: [], reply: `  ${"x".repeat(600)}  ` }, { fetcher });
    expect(turn).toMatchObject({ status: "continued", line: "Nice!", met: ["k1"] });
    expect((sent.reply as string).length).toBe(500);
    expect(await takeTurn({ situationId: "g", locale: "en", scene, history: [], reply: "Hi" }, { fetcher: reply(429, {}) })).toEqual({ status: "rateLimited" });
    expect(await getFeedback({ situationId: "g", locale: "en", scene, history: [], met: [] }, { fetcher: reply(503, {}) })).toEqual({ status: "unavailable" });
    let feedbackSent: Record<string, unknown> = {};
    await getFeedback(
      { situationId: "g", locale: "en", scene, history: [{ role: "learner", text: "Hi" }], met: ["k2"] },
      { fetcher: async (_url, init) => ((feedbackSent = JSON.parse(String(init?.body))), new Response(JSON.stringify({ status: "ready", replies: [] }))) },
    );
    expect(feedbackSent.met).toEqual(["k2"]);
    expect(sceneSummary(scene)).toBe("Mariam, the lift, cheerful");
  });
});

describe("conversations and progress", () => {
  it("lists each key point once, and scores a test from the key points met", async () => {
    const greeting = (await loadSituations()).find((situation) => situation.id === "greeting")!;
    const view = await toSituationView(greeting, await loadKhutuwat(), "en");
    const ids = keyPointsOf(view).map((point) => point.id);
    expect(new Set(ids).size).toBe(ids.length);
    const analysis = analyseConversations([
      { situation: "a", met: 2, total: 2 },
      { situation: "b", met: 1, total: 3 },
    ]);
    expect(analysis).toEqual({ met: 3, total: 5, strong: ["a"], practise: ["b"] });
  });

  it("tests the situations the learner has practised, or all of them before that", () => {
    const views = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
    expect(testSituations(views, () => false).map((view) => view.id)).toEqual(["a", "b", "c", "d"]);
    expect(testSituations(views, (id) => id === "b" || id === "e").map((view) => view.id)).toEqual(["b", "e"]);
  });

  it("calls a situation mastered once a conversation covered every key point", () => {
    const stop: SituationStop = { id: "greeting", order: 1, title: "", art: "", href: "/mawqif/greeting", turns: ["t1", "t2"], checks: ["c1"] };
    expect(situationStatus(stop, EMPTY_PROGRESS)).toBe("notStarted");
    const part = withBestRound(EMPTY_PROGRESS, conversationKey("greeting"), 1, 2, 1);
    expect(situationStatus(stop, part)).toBe("practised");
    expect(situationStatus(stop, withBestRound(part, conversationKey("greeting"), 2, 2, 2))).toBe("mastered");
  });
});

describe("why and when", () => {
  it("are shown only where the quoted text itself states a reason or a time", async () => {
    const situations = new Map((await loadSituations()).map((situation) => [situation.id, situation.learn]));
    expect(situations.get("colleague")?.why).toEqual([]);
    expect(situations.get("colleague")?.when).toEqual([]);
    expect(situations.get("eating")?.why).toEqual([]);
    expect(situations.get("eating")?.when.map((quote) => quote.ref)).toEqual(["b-eating", "h58122"]);
    expect(situations.get("condolence")?.when.map((quote) => quote.ref)).toEqual(["b-condolence", "q2-156"]);
    expect(situations.get("adhan")?.why.map((quote) => quote.ref)).toEqual(["h10635"]);
  });
});
