import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A sheet of paper pinned to the board, for what is not written in chalk: Quran and hadith text
 * (shown whole, from its source), media and the journal stamp. Inside it the day tone applies.
 */
export function PaperSlip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "tone-day relative rounded-2xl bg-paper text-foreground shadow-[0_12px_22px_-14px_color-mix(in_srgb,var(--night)_95%,transparent)]",
        className,
      )}
    >
      <span aria-hidden className="absolute -top-1.5 left-1/2 z-10 size-3.5 -translate-x-1/2 rounded-full border-2 border-night bg-dawn" />
      {children}
    </div>
  );
}
