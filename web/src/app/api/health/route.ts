import { callAiService } from "@/lib/ai-proxy";

import { version } from "../../../../package.json";

export const dynamic = "force-dynamic";

const AI_HEALTH_TIMEOUT_MS = 5_000;

/**
 * The web build, and whether the AI service answers /health through the same proxy the pages use
 * (so the shared key is checked too). Nothing secret is reported.
 */
export async function GET() {
  let ai: { reachable: boolean; status: number | null; version: string | null };
  try {
    const response = await callAiService("health", { timeoutMs: AI_HEALTH_TIMEOUT_MS });
    const body = response.ok ? ((await response.json()) as { version?: unknown }) : null;
    ai = { reachable: response.ok, status: response.status, version: typeof body?.version === "string" ? body.version : null };
  } catch {
    ai = { reachable: false, status: null, version: null };
  }
  return Response.json(
    {
      service: "rehla-web",
      version,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      environment: process.env.VERCEL_ENV ?? "local",
      ai,
    },
    { status: ai.reachable ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
