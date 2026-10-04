import { useId, type CSSProperties, type ComponentType, type SVGProps } from "react";

import { cn } from "@/lib/utils";

type StampTone = "terracotta" | "oasis" | "ink";

const toneClassName: Record<StampTone, string> = {
  terracotta: "text-terracotta-text",
  oasis: "text-oasis-text",
  ink: "text-ink",
};

type StampProps = {
  /** Text set around the ring, e.g. the unit's name. */
  ringText: string;
  /** A short word or date in the middle. Ignored when `icon` is given. */
  center?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  tone?: StampTone;
  rotate?: number;
  /** Press the stamp in when it first appears, as when a unit is completed. */
  appear?: boolean;
  /** Accessible name. Without it the stamp is decorative. */
  label?: string;
  className?: string;
};

/** A travel-journal stamp, inked slightly unevenly the way a real rubber stamp lands. */
export function Stamp({
  ringText,
  center,
  icon: Icon,
  tone = "terracotta",
  rotate = -8,
  appear = false,
  label,
  className,
}: StampProps) {
  const id = useId().replace(/[^\w-]/g, "");

  return (
    <svg
      viewBox="0 0 120 120"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-stamp-appear={appear ? "" : undefined}
      style={{ "--stamp-rotate": `${rotate}deg`, transform: `rotate(${rotate}deg)` } as CSSProperties}
      className={cn("font-display", toneClassName[tone], className)}
    >
      <defs>
        {/* Starts at the bottom and runs clockwise, so 50% is the top of the ring. */}
        <path id={`${id}-ring`} d="M60 101a41 41 0 1 1 0-82a41 41 0 1 1 0 82" />
        <filter id={`${id}-ink`} x="0" y="0" width="1" height="1">
          <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="7" result="noise" />
          <feColorMatrix
            in="noise"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 2.15"
            result="speckle"
          />
          <feComposite in="SourceGraphic" in2="speckle" operator="in" />
        </filter>
      </defs>

      <g filter={`url(#${id}-ink)`} opacity="0.92">
        <g fill="none" stroke="currentColor">
          <circle cx="60" cy="60" r="55" strokeWidth="3" />
          <circle cx="60" cy="60" r="49.5" strokeWidth="1" />
          <circle cx="60" cy="60" r="31" strokeWidth="1.25" strokeDasharray="2 3" />
        </g>
        <text fill="currentColor" fontSize="10.5" fontWeight="600" className="[&:lang(en)]:tracking-[0.16em]">
          <textPath href={`#${id}-ring`} startOffset="50%" textAnchor="middle">
            {ringText}
          </textPath>
        </text>
        {Icon ? (
          <Icon x="44" y="44" width="32" height="32" strokeWidth="2.25" />
        ) : (
          center && (
            <text x="60" y="66" textAnchor="middle" fontSize="16" fontWeight="700" fill="currentColor">
              {center}
            </text>
          )
        )}
      </g>
    </svg>
  );
}
