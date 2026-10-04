import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { isAiServiceReachable } from "@/lib/ai-service";
import { cn } from "@/lib/utils";

type Tone = "pending" | "online" | "offline";

const toneClassName: Record<Tone, string> = {
  pending: "bg-muted-foreground motion-safe:animate-pulse",
  online: "bg-success",
  offline: "bg-terracotta",
};

function StatusLine({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", toneClassName[tone])} />
      {children}
    </p>
  );
}

export async function AiServiceStatus() {
  const [t, reachable] = await Promise.all([
    getTranslations("AiServiceStatus"),
    isAiServiceReachable(),
  ]);

  return reachable ? (
    <StatusLine tone="online">{t("online")}</StatusLine>
  ) : (
    <StatusLine tone="offline">{t("offline")}</StatusLine>
  );
}

export function AiServiceStatusFallback() {
  const t = useTranslations("AiServiceStatus");

  return <StatusLine tone="pending">{t("checking")}</StatusLine>;
}
