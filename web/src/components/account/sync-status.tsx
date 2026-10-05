"use client";

import { Check, CloudOff, LoaderCircle, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";

import { useSyncStatus, type SyncStatus as Status } from "@/lib/account/sync";
import { cn } from "@/lib/utils";

const ICONS = { saved: Check, saving: LoaderCircle, offline: CloudOff, retrying: RotateCw } as const satisfies Record<Status, unknown>;

/** A quiet line saying whether the account holds everything yet. Nothing for a guest. */
export function SyncStatus({ className }: { className?: string }) {
  const t = useTranslations("AccountStatus");
  const status = useSyncStatus();
  if (!status) return null;
  const Icon = ICONS[status];
  return (
    <p role="status" className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <Icon aria-hidden className={cn("size-4 shrink-0", status === "saved" && "text-oasis-text", status === "saving" && "motion-safe:animate-spin")} />
      {t(status)}
    </p>
  );
}
