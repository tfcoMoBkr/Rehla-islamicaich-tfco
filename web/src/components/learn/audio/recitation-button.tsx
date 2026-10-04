"use client";

import { Pause, Play } from "lucide-react";
import { useTranslations } from "next-intl";

import { useRecitation } from "@/lib/audio/recitation";
import { stopSpeech } from "@/lib/audio/speech";
import type { RecitationSpan } from "@/lib/learn/types";

/** Plays a verse in its real recitation; a synthetic voice never reads Quran text. */
export function RecitationButton({ id, span }: { id: string; span: RecitationSpan | null }) {
  const t = useTranslations("Listen");
  const recitation = useRecitation(id, span, stopSpeech);
  if (!recitation.available) return null;

  return (
    <button
      type="button"
      onClick={recitation.toggle}
      aria-pressed={recitation.playing}
      className="inline-flex min-h-11 items-center gap-2 justify-self-start rounded-full border border-hairline bg-paper px-4 text-sm font-medium hover:border-muted-ink aria-pressed:border-dawn aria-pressed:bg-dawn/12"
    >
      {recitation.playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
      {recitation.playing ? t("pauseRecitation") : t("listenRecitation")}
    </button>
  );
}
