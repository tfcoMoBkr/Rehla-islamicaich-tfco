import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as health } from "../health/route";
import { GET, POST } from "./[path]/route";

type Seen = { url: string; method: string; headers: Headers; body: string | null };

/** A fake AI service: records what it is sent and answers with `reply`. */
function upstream(reply: () => Response) {
  const seen: Seen[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const body = init.body ? await new Response(init.body).text() : null;
    seen.push({ url, method: String(init.method), headers: new Headers(init.headers), body });
    return reply();
  });
  return seen;
}

const params = (path: string) => ({ params: Promise.resolve({ path }) });

const ask = (body: object) =>
  new Request("https://rehla.example/api/ai/ask", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    body: JSON.stringify(body),
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("the proxy to the AI service", () => {
  it("forwards a question with the shared key and the learner's address, and passes the reply through", async () => {
    vi.stubEnv("AI_SERVICE_URL", "https://ai.example/");
    vi.stubEnv("AI_SERVICE_KEY", "s3cret");
    const seen = upstream(() => Response.json({ kind: "chat" }, { status: 200 }));

    const response = await POST(ask({ question: "What is wudu?" }), params("ask"));

    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe("https://ai.example/ask");
    expect(seen[0]?.method).toBe("POST");
    expect(seen[0]?.headers.get("x-rehla-key")).toBe("s3cret");
    expect(seen[0]?.headers.get("x-rehla-client")).toBe("203.0.113.9");
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({ question: "What is wudu?" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ kind: "chat" });
  });

  it("never hands the key back to the browser", async () => {
    vi.stubEnv("AI_SERVICE_KEY", "s3cret");
    upstream(() => new Response("{}", { headers: { "content-type": "application/json", "x-rehla-key": "s3cret" } }));
    const response = await POST(ask({}), params("ask"));
    expect([...response.headers.values()].join(" ")).not.toContain("s3cret");
  });

  it("sends no key header when none is configured (local development)", async () => {
    vi.stubEnv("AI_SERVICE_KEY", "");
    const seen = upstream(() => Response.json({}));
    await POST(ask({}), params("ask"));
    expect(seen[0]?.headers.has("x-rehla-key")).toBe(false);
  });

  it("keeps the service's status and retry delay", async () => {
    upstream(() => Response.json({ error: { code: "rate_limited" } }, { status: 429, headers: { "retry-after": "30" } }));
    const response = await POST(ask({}), params("ask"));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
  });

  it("reaches only the service's own endpoints, each with its method", async () => {
    const seen = upstream(() => Response.json({}));
    expect((await POST(ask({}), params("docs"))).status).toBe(404);
    expect((await GET(new Request("https://rehla.example/api/ai/ask"), params("ask"))).status).toBe(404);
    expect((await POST(ask({}), params("health"))).status).toBe(404);
    expect(seen).toEqual([]);
  });

  it("forwards a Mawqif reply to the service's /mawqif/evaluate", async () => {
    const seen = upstream(() => Response.json({ status: "evaluated" }));
    await POST(ask({ reply: "salam" }), params("mawqif-evaluate"));
    expect(seen[0]?.url).toBe("http://localhost:8000/mawqif/evaluate");
  });

  it("says the service is unavailable when it cannot be reached", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    const response = await POST(ask({}), params("ask"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: "unavailable" } });
  });
});

describe("the web health route", () => {
  it("reports the build and the AI service's health through the proxy, with no secrets", async () => {
    vi.stubEnv("AI_SERVICE_KEY", "s3cret");
    vi.stubEnv("AI_SERVICE_URL", "https://ai.example");
    const seen = upstream(() => Response.json({ service: "rehla-ai", version: "0.1.0", status: "ok" }));

    const response = await health();
    const body = await response.json();

    expect(seen[0]?.url).toBe("https://ai.example/health");
    expect(seen[0]?.headers.get("x-rehla-key")).toBe("s3cret");
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ service: "rehla-web", ai: { reachable: true, status: 200, version: "0.1.0" } });
    expect(JSON.stringify(body)).not.toContain("s3cret");
    expect(JSON.stringify(body)).not.toContain("ai.example");
  });

  it("answers 503 when the AI service does not answer", async () => {
    upstream(() => new Response(null, { status: 401 }));
    const response = await health();
    expect(response.status).toBe(503);
    expect((await response.json()).ai).toEqual({ reachable: false, status: 401, version: null });
  });
});
