import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { ROAD_ANCHOR_ATTRIBUTE } from "@/lib/road";
import { cn } from "@/lib/utils";

import { RoadStop, type RoadSide } from "./road-stop";

/** `open` is a station the learner may enter but is not working on (e.g. skipped by choice). */
export type StationState = "locked" | "open" | "current" | "completed";

type StationMarkerProps = {
  state?: StationState;
  size?: "md" | "sm";
  /** Decorative stations (e.g. on the home page) light up when the traveller reaches them. */
  lightOnReach?: boolean;
  className?: string;
  children?: ReactNode;
};

export function StationMarker({
  state = "locked",
  size = "md",
  lightOnReach = false,
  className,
  children,
}: StationMarkerProps) {
  return (
    <span
      aria-hidden="true"
      {...{ [ROAD_ANCHOR_ATTRIBUTE]: "" }}
      data-state={state}
      data-size={size}
      data-light={lightOnReach ? "reach" : undefined}
      className={cn("station-marker [&_svg]:size-5", className)}
    >
      {children}
    </span>
  );
}

type StationProps = {
  title: string;
  icon: ReactNode;
  /** A short label above the title, such as "Station 2". */
  label?: string;
  /** Makes the whole card a link to this address. */
  href?: string;
  state?: StationState;
  /** Spoken state (e.g. "completed"); markers are decorative, so state must also be said in words. */
  stateLabel?: string;
  size?: "md" | "sm";
  lightOnReach?: boolean;
  side?: RoadSide;
  /** Badges or notes shown beside the label. */
  meta?: ReactNode;
  /** Who stands at this stop, e.g. Rafiq walking beside the learner's current lesson. */
  companion?: ReactNode;
  /** Fade the card; by default a locked station that is not a link is faded. */
  dimmed?: boolean;
  children?: ReactNode;
};

export function Station({
  title,
  icon,
  label,
  href,
  state = "locked",
  stateLabel,
  size,
  lightOnReach,
  side,
  meta,
  companion,
  dimmed = state === "locked" && href === undefined,
  children,
}: StationProps) {
  const heading = (
    <>
      {title}
      {stateLabel && <span className="sr-only"> ({stateLabel})</span>}
    </>
  );

  return (
    <RoadStop
      as="li"
      side={side}
      marker={
        <StationMarker state={state} size={size} lightOnReach={lightOnReach}>
          {icon}
        </StationMarker>
      }
    >
      <Card
        className={cn(
          "relative gap-2 px-5 py-5 sm:px-6",
          href && "transition-shadow focus-within:shadow-md hover:shadow-md",
          dimmed && "opacity-80",
          companion && "min-h-28 pe-24 sm:pe-28",
        )}
      >
        {companion && <div className="pointer-events-none absolute inset-e-3 bottom-2">{companion}</div>}
        {(label || meta) && (
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
            {label && <span>{label}</span>}
            {meta}
          </div>
        )}
        <h3 className={cn("leading-snug font-semibold", size === "sm" ? "text-lg" : "font-display text-xl sm:text-2xl")}>
          {href ? (
            // The link's hit area is stretched over the whole card.
            <Link href={href} className="rounded-sm after:absolute after:inset-0 after:rounded-xl">
              {heading}
            </Link>
          ) : (
            heading
          )}
        </h3>
        {children && <div className="relative z-10 text-muted-foreground">{children}</div>}
      </Card>
    </RoadStop>
  );
}
