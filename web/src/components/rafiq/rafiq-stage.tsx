"use client";

import type { RafiqPose } from "@/lib/content/schema";

import { RafiqFigure } from "./rafiq-figure";

/**
 * Rafiq standing in his own light. The light breathes while he thinks (the lantern-breathe motion
 * in globals.css, off under reduced motion) and rests softly otherwise.
 */
type RafiqStageProps = {
  pose: RafiqPose;
  thinking: boolean;
  height?: number;
  /** Set where a visible label already names him. */
  decorative?: boolean;
};

export function RafiqStage({ pose, thinking, height = 104, decorative = false }: RafiqStageProps) {
  return (
    <div data-lantern-state={thinking ? "thinking" : "idle"} className="relative shrink-0">
      <svg viewBox="0 0 100 100" aria-hidden className="lantern-halo absolute inset-[-18%] size-[136%] overflow-visible">
        <circle cx="50" cy="50" r="48" fill="var(--dawn)" opacity="0.12" />
        <circle cx="50" cy="50" r="32" fill="var(--dawn)" opacity="0.16" />
      </svg>
      <RafiqFigure pose={pose} height={height} decorative={decorative} className="relative rtl:-scale-x-100" />
    </div>
  );
}
