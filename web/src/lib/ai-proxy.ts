import "server-only";

import { aiServiceUrl } from "@/config/ai-service";

/*
 * The only way to the AI service: the browser calls /api/ai/<path> on this site, and the server
 * forwards it with the shared key (AI_SERVICE_KEY, never sent to the browser) and the learner's
 * address for the service's rate limit. The service refuses requests without the key.
 */

/** The service's endpoints the browser may reach, and the one method each accepts. */
export const AI_ROUTES = { ask: "POST", "lesson-help": "POST", lens: "POST", health: "GET" } as const;
export type AiRoute = keyof typeof AI_ROUTES;

/** Rafiq checks every answer against its sources before replying, which can take a while. */
export const AI_TIMEOUT_MS = 90_000;

// Must match ai/app/security.py.
export const KEY_HEADER = "x-rehla-key";
export const CLIENT_HEADER = "x-rehla-client";

export const isAiRoute = (path: string): path is AiRoute => Object.hasOwn(AI_ROUTES, path);

type AiRequest = {
  body?: BodyInit | null;
  contentType?: string | null;
  /** The learner's address as this site saw it, for the service's per-address rate limit. */
  client?: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export function callAiService(route: AiRoute, { body, contentType, client, signal, timeoutMs = AI_TIMEOUT_MS }: AiRequest = {}): Promise<Response> {
  const headers = new Headers({ accept: "application/json" });
  if (contentType) headers.set("content-type", contentType);
  if (client) headers.set(CLIENT_HEADER, client);
  const key = process.env.AI_SERVICE_KEY;
  if (key) headers.set(KEY_HEADER, key);
  const timeout = AbortSignal.timeout(timeoutMs);
  return fetch(`${aiServiceUrl()}/${route}`, {
    method: AI_ROUTES[route],
    headers,
    body: AI_ROUTES[route] === "POST" ? body : undefined,
    // Streams the request body through rather than buffering it.
    ...(body ? { duplex: "half" } : {}),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    cache: "no-store",
  } as RequestInit);
}

/** The learner's address: the first hop the platform recorded. */
export function clientAddress(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip");
}
