"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";

import { useDirection } from "@/components/ui/direction";

const FRAME = "bg-[color-mix(in_srgb,var(--terracotta)_32%,var(--night))]";
const SWIPE_DISTANCE = 70;

type ChalkBoardProps = {
  label: string;
  /** Swiping back (toward where reading starts) shows the previous board. */
  onSwipeBack?: () => void;
  onSwipeForward?: () => void;
  children: ReactNode;
};

/** The slate the lesson is written on, with its chalk tray and the legs it stands on. */
export function ChalkBoard({ label, onSwipeBack, onSwipeForward, children }: ChalkBoardProps) {
  const rtl = useDirection() === "rtl";
  const start = useRef<{ x: number; y: number } | null>(null);
  const swipes = onSwipeBack || onSwipeForward;

  const swipeHandlers = swipes
    ? {
        onPointerDown: (event: PointerEvent<HTMLElement>) => {
          start.current = { x: event.clientX, y: event.clientY };
        },
        onPointerUp: (event: PointerEvent<HTMLElement>) => {
          const from = start.current;
          start.current = null;
          if (!from) return;
          const dx = event.clientX - from.x;
          if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(event.clientY - from.y) * 2) return;
          const back = rtl ? dx < 0 : dx > 0;
          if (back) onSwipeBack?.();
          else onSwipeForward?.();
        },
        onPointerCancel: () => {
          start.current = null;
        },
      }
    : {};

  return (
    <div>
      <section
        aria-label={label}
        {...swipeHandlers}
        className="chalk-board tone-board relative grid touch-pan-y gap-6 rounded-2xl px-4 pt-7 pb-6 sm:px-8 sm:pt-9"
      >
        {children}
      </section>
      <div aria-hidden className={`relative mx-4 h-3 rounded-b-lg ${FRAME}`}>
        <span className="absolute -top-1.5 start-[18%] h-1.5 w-8 rounded-full bg-paper" />
        <span className="absolute -top-1.5 start-[34%] h-1.5 w-5 rounded-full bg-dawn" />
      </div>
      <div aria-hidden className="mx-auto flex max-w-md justify-between px-10">
        <span className={`h-14 w-3 ${FRAME}`} />
        <span className={`h-14 w-3 ${FRAME}`} />
      </div>
    </div>
  );
}
