"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type PointerEvent } from "react";

import { useRafiqReaction } from "@/components/learn/board/rafiq-context";
import { useDirection } from "@/components/ui/direction";
import type { ActivityView } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type DayArcProps = {
  activity: Extract<ActivityView, { type: "dayArc" }>;
  /** Called with how many stops have been visited. */
  onProgress: (visited: number) => void;
  /** Called with the stop the sun is at. */
  onFocus?: (stop: number) => void;
};

const WIDTH = 320;
const HORIZON = 172;
const RADIUS = 140;

/**
 * The day as an arc of sky with the lesson's stops along it, in the order the lesson lists
 * them. The stops are evenly spaced: the arc shows sequence, not clock times; each stop's own
 * description says when it is. Time runs in the reading direction. The sun can be dragged
 * along the arc; the slider and the stop buttons do the same without dragging.
 */
export function DayArc({ activity, onProgress, onFocus }: DayArcProps) {
  const t = useTranslations("Activity");
  const id = useId();
  const rtl = useDirection() === "rtl";
  const { stops } = activity;
  const [index, setIndex] = useState(0);
  const [visited, setVisited] = useState<string[]>(stops[0] ? [stops[0].id] : []);
  const [dragging, setDragging] = useState(false);
  const react = useRafiqReaction();

  const positionOf = (stop: number) => (stops.length > 1 ? 0.08 + (0.84 * stop) / (stops.length - 1) : 0.5);
  const point = (at: number) => {
    const angle = Math.PI * (1 - at);
    const x = WIDTH / 2 + RADIUS * Math.cos(angle);
    return { x: rtl ? WIDTH - x : x, y: HORIZON - RADIUS * Math.sin(angle) };
  };

  function moveTo(next: number) {
    if (next === index) return;
    setIndex(next);
    onFocus?.(next);
    const stop = stops[next];
    if (stop && !visited.includes(stop.id)) {
      const explored = [...visited, stop.id];
      setVisited(explored);
      onProgress(explored.length);
      react("pleased");
    }
  }

  /** The stop nearest to where the pointer is on the arc. */
  function stopAt(event: PointerEvent<SVGSVGElement>): number {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * WIDTH;
    const y = ((event.clientY - box.top) / box.height) * 200;
    const angle = Math.atan2(Math.max(HORIZON - y, 0), (rtl ? WIDTH - x : x) - WIDTH / 2);
    const at = 1 - angle / Math.PI;
    let nearest = 0;
    stops.forEach((_, position) => {
      if (Math.abs(positionOf(position) - at) < Math.abs(positionOf(nearest) - at)) nearest = position;
    });
    return nearest;
  }

  const current = stops[index];
  const sun = point(positionOf(index));
  const night = Math.round((1 - Math.sin(Math.PI * positionOf(index))) * 80);
  const start = point(0);
  const end = point(1);

  return (
    <div className="grid gap-5">
      <svg
        viewBox={`0 0 ${WIDTH} 200`}
        aria-hidden
        className={cn("w-full touch-none overflow-visible rounded-2xl", dragging ? "cursor-grabbing" : "cursor-grab")}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
          moveTo(stopAt(event));
        }}
        onPointerMove={(event) => {
          if (dragging) moveTo(stopAt(event));
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <rect
          width={WIDTH}
          height={HORIZON}
          rx="16"
          style={{ fill: `color-mix(in oklab, var(--night) ${night}%, var(--sand))`, transition: "fill 0.3s" }}
        />
        <path
          d={`M${start.x} ${start.y}A${RADIUS} ${RADIUS} 0 0 ${rtl ? 0 : 1} ${end.x} ${end.y}`}
          fill="none"
          strokeWidth="2"
          strokeDasharray="4 6"
          className="stroke-dawn/70"
        />
        {stops.map((stop, position) => {
          const at = point(positionOf(position));
          return (
            <circle
              key={stop.id}
              cx={at.x}
              cy={at.y}
              r="6"
              className={cn(position === index ? "fill-dawn" : visited.includes(stop.id) ? "fill-success" : "fill-border")}
            />
          );
        })}
        <rect y={HORIZON} width={WIDTH} height="28" rx="4" fill="var(--ink)" />
        <circle cx={sun.x} cy={sun.y} r="20" fill="var(--dawn)" opacity="0.25" />
        <circle cx={sun.x} cy={sun.y} r="12" fill="var(--dawn)" stroke="var(--paper)" strokeWidth="2" />
      </svg>

      <div className="grid gap-2">
        <label htmlFor={id} className="text-sm font-medium text-muted-foreground">
          {t("moveTheSun")}
        </label>
        <input
          id={id}
          type="range"
          min={0}
          max={Math.max(stops.length - 1, 0)}
          step={1}
          value={index}
          dir={rtl ? "rtl" : "ltr"}
          aria-valuetext={current?.label}
          onChange={(event) => moveTo(Number(event.target.value))}
          className="h-11 w-full cursor-pointer accent-dawn"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {stops.map((stop, position) => (
          <button
            key={stop.id}
            type="button"
            aria-pressed={position === index}
            onClick={() => moveTo(position)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors aria-pressed:border-dawn aria-pressed:bg-dawn/15",
              visited.includes(stop.id) ? "border-success/50" : "border-border",
            )}
          >
            {stop.label}
          </button>
        ))}
      </div>

      {current && (
        <div aria-live="polite" className="rounded-2xl border border-border bg-card p-5">
          <p className="font-display text-xl font-semibold">{current.label}</p>
          <p className="mt-1">{current.detail}</p>
          <p className="mt-3 inline-flex rounded-full bg-dawn/15 px-3 py-1 text-sm font-semibold">
            {t("rakahs", { count: current.count })}
          </p>
        </div>
      )}
      <p className="text-sm text-muted-foreground">{t("explored", { explored: visited.length, total: stops.length })}</p>
    </div>
  );
}
