import { describe, expect, it } from "vitest";

import { askAboutPhoto, LENS_TURN_PATH, type TurnRequest } from "./conversation";

const request: TurnRequest = {
  locale: "en",
  seen: { kind: "object", subject: "prayer mat", confidence: 0.9 },
  question: "  What colour is it?  ",
  history: [],
  photo: { base64: "AAAA", mimeType: "image/jpeg" },
};

function service(statuses: string[]) {
  const bodies: Record<string, unknown>[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    expect(String(url)).toBe(LENS_TURN_PATH);
    bodies.push(JSON.parse(String(init?.body)));
    const status = statuses[bodies.length - 1] ?? "answered";
    return new Response(JSON.stringify({ status, visual: status === "answered" ? "It is green." : null, suggestions: [] }));
  };
  return { bodies, fetcher };
}

describe("asking about a photo", () => {
  it("sends the reading and the question, never the photo, when the turn is not about what can be seen", async () => {
    const { bodies, fetcher } = service(["answered"]);
    const result = await askAboutPhoto(request, { fetcher });
    expect(result.kind).toBe("turn");
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ question: "What colour is it?", seen: request.seen });
    expect(bodies[0]).not.toHaveProperty("image");
  });

  it("sends the photo once more only when the service asks for it", async () => {
    const { bodies, fetcher } = service(["needsImage", "answered"]);
    const result = await askAboutPhoto(request, { fetcher });
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toMatchObject({ image: "AAAA", mimeType: "image/jpeg" });
    expect(result.kind === "turn" && result.response.visual).toBe("It is green.");
  });

  it("an example has no photo to send: the turn ends without a visual answer", async () => {
    const { bodies, fetcher } = service(["needsImage"]);
    const result = await askAboutPhoto({ ...request, photo: undefined }, { fetcher });
    expect(bodies).toHaveLength(1);
    expect(result.kind === "turn" && result.response.status).toBe("answered");
    expect(result.kind === "turn" && result.response.visual).toBeNull();
  });

  it("keeps at most eight earlier turns", async () => {
    const { bodies, fetcher } = service(["answered"]);
    const history = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? ("assistant" as const) : ("user" as const), text: `t${i}` }));
    await askAboutPhoto({ ...request, history }, { fetcher });
    expect(bodies[0]?.history).toEqual(history.slice(-8));
  });
});
