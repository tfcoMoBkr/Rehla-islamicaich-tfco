import "server-only";

import { connection } from "next/server";

import { aiServiceUrl } from "@/config/ai-service";

const HEALTH_CHECK_TIMEOUT_MS = 2000;

export async function isAiServiceReachable(): Promise<boolean> {
  // Opt into request-time rendering before the try block, so the prerender
  // bailout is not swallowed by the catch below.
  await connection();

  try {
    const response = await fetch(`${aiServiceUrl}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}
