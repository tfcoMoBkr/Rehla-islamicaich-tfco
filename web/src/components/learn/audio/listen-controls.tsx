"use client";

import { Pause, Play, Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";

import type { ReadAloud } from "@/lib/audio/speech";
import { cn } from "@/lib/utils";

/** Play/pause and reading speed for a read-aloud. Renders nothing when the device has no voice. */
export function ListenControls({ reader, className }: { reader: ReadAloud; className?: string }) {
  const t = useTranslations("Listen");
  if (!reader.supported) return null;

  const Icon = reader.playing ? Pause : reader.current === null ? Volume2 : Play;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <button
        type="button"
        onClick={reader.toggle}
        aria-pressed={reader.playing}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium transition-colors hover:border-input aria-pressed:border-dawn aria-pressed:bg-dawn/12"
      >
        <Icon aria-hidden className="size-4 text-primary" />
        {reader.playing ? t("pause") : t("listen")}
      </button>
      <button
        type="button"
        onClick={reader.cycleRate}
        aria-label={t("speed", { rate: reader.rate })}
        className="inline-flex min-h-11 min-w-14 items-center justify-center rounded-full border border-border bg-card px-3 text-sm font-semibold tabular-nums hover:border-input"
      >
        <span dir="ltr">{reader.rate}×</span>
      </button>
      <span className="sr-only" aria-live="polite">
        {reader.playing ? t("reading") : ""}
      </span>
    </div>
  );
}
