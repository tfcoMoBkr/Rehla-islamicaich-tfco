import { describe, expect, it, vi } from "vitest";

import { EMPTY_PROGRESS, withBestRound, withProvisions, type Progress } from "@/lib/learn/progress";

import { EVALUATE_PATH, evaluateReply } from "./evaluate";
import { analyseTest, checkRoundKey, nextStop, situationStatus, turnKey } from "./progress";
import { orderedChoices, outcomeOfChoice, outcomeOfWriting } from "./turn";
import type { ExchangeView, SituationStop } from "./types";

const stop: SituationStop = { id: "greeting", order: 1, title: "Greeting", art: "greeting", href: "/mawqif/greeting", turns: ["t1", "t2"], checks: ["c1", "c2"] };
const other: SituationStop = { ...stop, id: "mosque", order: 2, href: "/mawqif/mosque" };

const quote = (ref: string) => ({ ref, text: "…", source: { kind: "quran" as const, ref: "4:86", url: null } });
const exchange: ExchangeView = {
  id: "t1",
  says: [{ kind: "text", text: "Hello" }],
  keyPoints: [
    { id: "k1", quote: quote("q1") },
    { id: "k2", quote: quote("q2") },
  ],
  choices: [
    { id: "a", quality: "best", reply: [{ kind: "text", text: "best" }], meets: ["k1", "k2"] },
    { id: "b", quality: "acceptable", reply: [{ kind: "text", text: "ok" }], meets: ["k1"] },
    { id: "c", quality: "avoid", reply: [{ kind: "text", text: "no" }], meets: [] },
  ],
};

const earn = (progress: Progress, id: string) => withProvisions(progress, id, 2, 1);

describe("Mawqif progress", () => {
  it("is not started, then practised, then mastered when every turn was best and the check all right", () => {
    expect(situationStatus(stop, EMPTY_PROGRESS)).toBe("notStarted");
    const oneTurn = earn(EMPTY_PROGRESS, turnKey("greeting", "t1"));
    expect(situationStatus(stop, oneTurn)).toBe("practised");
    const allTurns = earn(oneTurn, turnKey("greeting", "t2"));
    expect(situationStatus(stop, withBestRound(allTurns, checkRoundKey("greeting"), 1, 2, 5))).toBe("practised");
    expect(situationStatus(stop, withBestRound(allTurns, checkRoundKey("greeting"), 2, 2, 5))).toBe("mastered");
    expect(situationStatus(other, allTurns)).toBe("notStarted");
  });

  it("points to the first situation not yet mastered", () => {
    const mastered = withBestRound(earn(earn(EMPTY_PROGRESS, turnKey("greeting", "t1")), turnKey("greeting", "t2")), checkRoundKey("greeting"), 2, 2, 5);
    expect(nextStop([stop, other], EMPTY_PROGRESS)?.id).toBe("greeting");
    expect(nextStop([stop, other], mastered)?.id).toBe("mosque");
  });

  it("analyses a final test: situations handled well, and situations to practise again", () => {
    const analysis = analyseTest([
      { situation: "greeting", check: "c1", correct: true },
      { situation: "mosque", check: "c1", correct: false },
      { situation: "greeting", check: "c2", correct: true },
      { situation: "mosque", check: "c2", correct: true },
    ]);
    expect(analysis).toEqual({ score: { correct: 3, total: 4 }, strong: ["greeting"], practise: ["mosque"] });
  });
});

describe("a role-play turn, in both answer modes", () => {
  it("takes a chosen reply's own key points and quality", () => {
    expect(outcomeOfChoice(exchange.choices[1]!)).toMatchObject({ met: ["k1"], quality: "acceptable", gentler: false, encouragement: null });
  });

  it("judges a written reply by the key points the service found, ignoring any it does not know", () => {
    const evaluation = { status: "evaluated" as const, met: ["k2", "k9"], missing: ["k1"], tone: "gentler" as const, encouragement: "Kind, {{name}}." };
    expect(outcomeOfWriting(exchange, "my reply", evaluation)).toEqual({
      reply: [{ kind: "text", text: "my reply" }],
      met: ["k2"],
      quality: "acceptable",
      gentler: true,
      encouragement: "Kind, {{name}}.",
    });
    expect(outcomeOfWriting(exchange, "x", { ...evaluation, met: ["k1", "k2"] }).quality).toBe("best");
    expect(outcomeOfWriting(exchange, "x", { ...evaluation, met: [] }).quality).toBe("avoid");
  });

  it("does not always put the best reply first", () => {
    expect(orderedChoices(exchange.choices, 0)[0]?.quality).toBe("best");
    expect(orderedChoices(exchange.choices, 1)[0]?.quality).not.toBe("best");
  });
});

describe("the reply evaluation client", () => {
  const reply = (body: unknown, status = 200) => vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));

  it("sends the situation, the turn, the reply and the language, and never the learner's name", async () => {
    const fetcher = reply({ status: "evaluated", met: ["k1"], missing: ["k2"], tone: "fine", encouragement: null });
    const result = await evaluateReply({ situationId: "greeting", turnId: "t1", reply: "  salam  ", locale: "ar" }, { fetcher });
    const [path, init] = fetcher.mock.calls[0] ?? [];
    expect(path).toBe(EVALUATE_PATH);
    expect(JSON.parse(String(init?.body))).toEqual({ situationId: "greeting", turnId: "t1", reply: "salam", locale: "ar" });
    expect(result).toMatchObject({ status: "evaluated", met: ["k1"] });
  });

  it("falls back to the written choices when the service cannot answer", async () => {
    expect((await evaluateReply({ situationId: "g", turnId: "t1", reply: "x", locale: "en" }, { fetcher: reply({}, 503) })).status).toBe("unavailable");
    expect((await evaluateReply({ situationId: "g", turnId: "t1", reply: "x", locale: "en" }, { fetcher: reply({ nonsense: true }) })).status).toBe("unavailable");
    expect((await evaluateReply({ situationId: "g", turnId: "t1", reply: "x", locale: "en" }, { fetcher: reply({}, 429) })).status).toBe("rateLimited");
    const offline = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    expect((await evaluateReply({ situationId: "g", turnId: "t1", reply: "x", locale: "en" }, { fetcher: offline })).status).toBe("unavailable");
  });
});
