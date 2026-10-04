"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";

import { setBoardSounds, useBoardSounds } from "@/lib/audio/sound-setting";

/** Turns the board's natural sounds on or off; the choice is remembered on this device. */
export function SoundToggle() {
  const t = useTranslations("Board");
  const on = useBoardSounds();
  const Icon = on ? Volume2 : VolumeX;

  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => setBoardSounds(!on)}
      className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors hover:bg-accent"
    >
      <Icon aria-hidden className="size-5" />
      <span className="sr-only sm:not-sr-only">{t("sounds")}</span>
      <span className="sr-only">{on ? t("soundsOn") : t("soundsOff")}</span>
    </button>
  );
}
