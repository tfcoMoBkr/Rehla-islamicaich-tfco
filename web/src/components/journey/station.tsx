import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { ROAD_ANCHOR_ATTRIBUTE } from "@/lib/road";
import { cn } from "@/lib/utils";

import { RoadStop, type RoadSide } from "./road-stop";

export type StationState = "locked" | "current" | "completed";

type StationMarkerProps = {
  state?: StationState;
  /** Decorative stations (e.g. on the home page) light up when the traveller reaches them. */
  lightOnReach?: boolean;
  className?: string;
  children?: ReactNode;
};

export function StationMarker({
  state = "locked",
  lightOnReach = false,
  className,
  children,
}: StationMarkerProps) {
  return (
    <span
      aria-hidden="true"
      {...{ [ROAD_ANCHOR_ATTRIBUTE]: "" }}
      data-state={state}
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
  state?: StationState;
  /** Spoken state (e.g. "completed"); markers are decorative, so state must also be said in words. */
  stateLabel?: string;
  lightOnReach?: boolean;
  side?: RoadSide;
  children?: ReactNode;
};

export function Station({
  title,
  icon,
  label,
  state = "locked",
  stateLabel,
  lightOnReach,
  side,
  children,
}: StationProps) {
  return (
    <RoadStop
      as="li"
      side={side}
      marker={
        <StationMarker state={state} lightOnReach={lightOnReach}>
          {icon}
        </StationMarker>
      }
    >
      <Card className="gap-2 px-5 py-5 sm:px-6">
        {label && <p className="text-sm font-medium text-muted-foreground">{label}</p>}
        <h3 className="font-display text-xl leading-snug font-semibold sm:text-2xl">
          {title}
          {stateLabel && <span className="sr-only"> ({stateLabel})</span>}
        </h3>
        {children && <div className="text-muted-foreground">{children}</div>}
      </Card>
    </RoadStop>
  );
}
