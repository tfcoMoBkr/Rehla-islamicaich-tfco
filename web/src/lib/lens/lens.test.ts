import { describe, expect, it, vi } from "vitest";

import { exampleSeen } from "./examples";
import { LENS_PATH, readLens } from "./lens";

const reply = (body: unknown, status = 200) => vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));

const answered = {
  seen: { kind: "object", subject: "prayer mat", confidence: 0.9 },
  row: 1,
  answer: { language: "en", level: "A", referred: false, blocks: [{ type: "text", text: "Text [1]." }], sources: [] },
  card: null,
  others: ["miswak"],
};

describe("the Lens client", () => {
  it("sends the photo, the page language and the lessons reached through this site's proxy, nothing else", async () => {
    const fetcher = reply(answered);
    await readLens({ locale: "ar", photo: { base64: "QUJD", mimeType: "image/jpeg" }, reachedLessonIds: ["1.1"] }, { fetcher });

    const [path, init] = fetcher.mock.calls[0] ?? [];
    expect(path).toBe(LENS_PATH);
    expect(JSON.parse(String(init?.body))).toEqual({ locale: "ar", image: "QUJD", mimeType: "image/jpeg", reachedLessonIds: ["1.1"] });
  });

  it("sends an example as a reading, with no image", async () => {
    const fetcher = reply(answered);
    await readLens({ locale: "en", seen: exampleSeen("prayerMat", "en") }, { fetcher });
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(body.image).toBeUndefined();
    expect(body.seen).toMatchObject({ kind: "object", subject: "a prayer mat", category: "worship" });
  });

  it("guards the answer like any Rafiq answer: religious text without a source becomes a referral", async () => {
    const result = await readLens({ locale: "en", seen: exampleSeen("wudu", "en") }, { fetcher: reply(answered) });
    expect(result.kind).toBe("result");
    if (result.kind !== "result") return;
    expect(result.response.answer?.kind).toBe("referral");
    expect(result.response.answer?.referral?.reason).toBe("noSource");
    expect(result.response.others).toEqual(["miswak"]);
  });

  it.each([
    [429, {}, "rateLimited"],
    [413, { error: { code: "image_too_large" } }, "tooLarge"],
    [422, { error: { code: "image_type" } }, "badType"],
    [503, { error: { code: "unavailable" } }, "unavailable"],
    [500, {}, "error"],
  ] as const)("says what went wrong in its own words (%i)", async (status, body, kind) => {
    expect((await readLens({ locale: "en", seen: exampleSeen("mosque", "en") }, { fetcher: reply(body, status) })).kind).toBe(kind);
  });

  it("stores an example's reading, with no translation of the religious term it shows", () => {
    for (const locale of ["ar", "en"] as const) {
      const calligraphy = exampleSeen("calligraphy", locale);
      expect(calligraphy.plainTranslation).toBeNull();
      expect(calligraphy.religiousTerms).toEqual([calligraphy.visibleText?.text]);
    }
    expect(exampleSeen("mosque", "ar").subject).toBe("المسجد");
  });
});
