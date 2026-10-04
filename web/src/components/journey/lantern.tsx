import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

export type LanternState = "idle" | "thinking";

type LanternProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  state?: LanternState;
  /** Accessible name. Without it the lantern is decorative. */
  label?: string;
};

/**
 * Rafiq's mark: a traveller's lantern, the companion who carries the light.
 * Idle, it burns softly; thinking, its light breathes. Frame strokes follow `currentColor`.
 */
export function Lantern({ state = "idle", label, className, ...props }: LanternProps) {
  return (
    <svg
      viewBox="0 0 64 72"
      fill="none"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-lantern-state={state}
      className={cn("overflow-visible", className)}
      {...props}
    >
      <g className="lantern-halo" fill="var(--dawn)">
        <circle cx="32" cy="38" r="30" opacity="0.1" />
        <circle cx="32" cy="38" r="20" opacity="0.16" />
      </g>

      <g
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      >
        <path d="M25 13c0-8.5 14-8.5 14 0" vectorEffect="non-scaling-stroke" />
        <path
          d="M24 19c-5 11-5 26 0 37h16c5-11 5-26 0-37z"
          fill="var(--dawn)"
          fillOpacity="0.16"
          vectorEffect="non-scaling-stroke"
        />
        <path d="M28.5 19.5c-2.6 11-2.6 25 0 36M35.5 19.5c2.6 11 2.6 25 0 36" opacity="0.45" vectorEffect="non-scaling-stroke" />
        <path d="M21 13h22l-3 6H24z" fill="currentColor" vectorEffect="non-scaling-stroke" />
        <path d="M21 56h22l-2 5H23z" fill="currentColor" vectorEffect="non-scaling-stroke" />
      </g>

      <g className="lantern-flame">
        <path d="M32 27c4.6 5.8 5 11.4 0 17.5-5-6.1-4.6-11.7 0-17.5z" fill="var(--dawn)" />
        <path d="M32 35.5c1.8 2.6 2 5 0 7.6-2-2.6-1.8-5 0-7.6z" fill="var(--paper)" opacity="0.85" />
      </g>
    </svg>
  );
}
