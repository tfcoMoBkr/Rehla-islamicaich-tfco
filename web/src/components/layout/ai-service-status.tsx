"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type Tone = "pending" | "online" | "offline";

const HEALTH_PATH = "/api/ai/health";
const TIMEOUT_MS = 4000;

const toneClassName: Record<Tone, string> = {
  pending: "bg-muted-foreground motion-safe:animate-pulse",
  online: "bg-success",
  offline: "bg-terracotta",
};

// One check per page session, shared by every page the visitor opens.
let check: Promise<boolean> | null = null;

function reachable(): Promise<boolean> {
  check ??= fetch(HEALTH_PATH, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) })
    .then((response) => response.ok)
    .catch(() => false);
  return check;
}

/**
 * Whether the AI service answers, checked from the browser through the same-origin rewrite. It
 * runs after the page is shown, so no page waits for it and every page can be rendered statically.
 */
export function AiServiceStatus() {
  const t = useTranslations("AiServiceStatus");
  const [tone, setTone] = useState<Tone>("pending");

  useEffect(() => {
    let current = true;
    void reachable().then((ok) => {
      if (current) setTone(ok ? "online" : "offline");
    });
    return () => {
      current = false;
    };
  }, []);

  return (
    <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", toneClassName[tone])} />
      {t(tone === "pending" ? "checking" : tone)}
    </p>
  );
}
