"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import type { RafiqMood } from "./rafiq-context";

/**
 * Rafiq, the lantern who teaches at the board: a character with no face, whose light and stance
 * say how he feels. Drawn in ink with a paper outline, so he reads against night and dawn alike.
 */
export function RafiqLantern({ mood, className }: { mood: RafiqMood; className?: string }) {
  return (
    <svg viewBox="0 0 72 96" fill="none" aria-hidden data-mood={mood} className={cn("rafiq overflow-visible", className)}>
      <g className="rafiq-halo" fill="var(--dawn)">
        <circle cx="36" cy="52" r="34" opacity="0.12" />
        <circle cx="36" cy="52" r="22" opacity="0.2" />
      </g>
      <circle className="rafiq-glow" cx="36" cy="50" r="13" fill="var(--dawn)" />
      <g stroke="var(--paper)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M29 17c0-9 14-9 14 0" />
        <path d="M23 17h26l-4 8H27z" fill="var(--ink)" />
        <path d="M27 25c-6 12-6 31 0 45h18c6-14 6-33 0-45z" fill="var(--dawn)" fillOpacity="0.24" />
        <path d="M32 26c-3 12-3 30 0 43M40 26c3 12 3 30 0 43" opacity="0.5" />
        <path d="M23 70h26l-3 7H26z" fill="var(--ink)" />
        <path d="M30 77l-3 10M42 77l3 10" />
      </g>
      <g className="rafiq-flame">
        <path d="M36 36c5.5 7 6 13.5 0 21-6-7.5-5.5-14 0-21z" fill="var(--dawn)" />
        <path d="M36 46c2 3 2.3 6 0 9-2.3-3-2-6 0-9z" fill="var(--paper)" opacity="0.9" />
      </g>
    </svg>
  );
}

/** Rafiq beside the board's top corner, with what he says in a speech bubble. */
export function RafiqAtBoard({ mood, caption }: { mood: RafiqMood; caption: string }) {
  const t = useTranslations("Board");

  return (
    <div className="relative z-10 -mb-4 flex items-end gap-2 ps-1">
      <RafiqLantern mood={mood} className="h-20 w-auto shrink-0" />
      <p
        aria-live="polite"
        className="relative mb-6 max-w-[16rem] rounded-2xl rounded-es-sm bg-paper px-3.5 py-2 text-sm leading-snug font-medium text-ink shadow-[0_10px_18px_-12px_color-mix(in_srgb,var(--night)_90%,transparent)]"
      >
        <span className="sr-only">{t("rafiqSays")} </span>
        {caption}
      </p>
    </div>
  );
}
