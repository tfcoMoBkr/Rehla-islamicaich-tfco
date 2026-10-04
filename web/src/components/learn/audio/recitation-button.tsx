"use client";

import { LoaderCircle, Pause, Play, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import { useRecitation } from "@/lib/audio/recitation";
import { stopSpeech } from "@/lib/audio/speech";
import type { RecitationSpan } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

/** Plays a verse in its real recitation; a synthetic voice never reads Quran text. */
export function RecitationButton({ id, span }: { id: string; span: RecitationSpan | null }) {
  const t = useTranslations("Listen");
  const recitation = useRecitation(id, span, stopSpeech);
  if (!recitation.available) return null;

  const { status } = recitation;
  const Icon = status === "loading" ? LoaderCircle : status === "playing" ? Pause : status === "error" ? RotateCcw : Play;
  const label = {
    idle: t("listenRecitation"),
    loading: t("loadingRecitation"),
    playing: t("pauseRecitation"),
    error: t("retryRecitation"),
  }[status];

  return (
    <div className="grid justify-items-start gap-1">
      <button
        type="button"
        onClick={recitation.toggle}
        aria-pressed={status === "playing"}
        aria-busy={status === "loading"}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline bg-paper px-4 text-sm font-medium hover:border-muted-ink aria-pressed:border-dawn aria-pressed:bg-dawn/12"
      >
        <Icon aria-hidden className={cn("size-4", status === "loading" && "motion-safe:animate-spin")} />
        {label}
      </button>
      <p aria-live="polite" className={cn("text-sm", status === "error" ? "text-terracotta-text" : "sr-only")}>
        {status === "error" ? t("recitationFailed") : status === "playing" ? t("recitationPlaying") : ""}
      </p>
    </div>
  );
}
