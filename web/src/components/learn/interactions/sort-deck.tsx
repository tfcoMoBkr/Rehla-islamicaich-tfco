"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState, type PointerEvent } from "react";

import { Feedback } from "@/components/learn/feedback";
import { stableShuffle } from "@/lib/learn/shuffle";
import type { Group } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

import { missedClassName, optionClassName } from "./option-styles";

type Item = { id: string; text: string; group: string; sourceQuote?: string };

type SortDeckProps = {
  groups: readonly Group[];
  items: readonly Item[];
  seed: string;
  /** `swipe` takes exactly two groups, [left, right]: physical sides, as lesson files name them. */
  variant?: "buttons" | "swipe";
  hints?: boolean;
  onComplete: (mistakes: number) => void;
  /** Called with how many steps are done, after each one. */
  onProgress?: (done: number) => void;
};

const SWIPE_DISTANCE = 90;

/** One card at a time, placed into its group. */
export function SortDeck({ groups, items, seed, variant = "buttons", hints = true, onComplete, onProgress }: SortDeckProps) {
  const t = useTranslations("Activity");
  const deck = useMemo(() => stableShuffle(items, seed), [items, seed]);
  const [position, setPosition] = useState(0);
  const [missed, setMissed] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [drag, setDrag] = useState(0);
  const dragStart = useRef<number | null>(null);

  const current = deck[position];
  const done = position >= deck.length;
  const isSwipe = variant === "swipe" && groups.length === 2;

  function place(groupId: string) {
    if (!current) return;
    if (groupId !== current.group) {
      setMistakes((count) => count + 1);
      setMissed(true);
      return;
    }
    setMissed(false);
    setPosition(position + 1);
    onProgress?.(position + 1);
    if (position + 1 === deck.length) onComplete(mistakes);
  }

  function groupForDrag(distance: number): string | undefined {
    return groups[distance > 0 ? 1 : 0]?.id;
  }

  const swipeHandlers = isSwipe
    ? {
        onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
          dragStart.current = event.clientX;
          event.currentTarget.setPointerCapture(event.pointerId);
        },
        onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
          if (dragStart.current !== null) setDrag(event.clientX - dragStart.current);
        },
        onPointerUp: () => {
          const groupId = Math.abs(drag) >= SWIPE_DISTANCE ? groupForDrag(drag) : undefined;
          dragStart.current = null;
          setDrag(0);
          if (groupId) place(groupId);
        },
        onPointerCancel: () => {
          dragStart.current = null;
          setDrag(0);
        },
      }
    : {};

  const placedIn = (groupId: string) => deck.slice(0, position).filter((item) => item.group === groupId);

  return (
    <div className="grid gap-5">
      {!done && current && (
        <>
          <p className="text-sm text-muted-foreground">
            {t("cardOf", { current: position + 1, total: deck.length })}
            {isSwipe && <span className="ms-2">{t("swipeHint")}</span>}
          </p>
          <div
            {...swipeHandlers}
            style={drag ? { transform: `translateX(${drag}px) rotate(${drag / 24}deg)` } : undefined}
            className={cn(
              "grid min-h-36 place-items-center rounded-2xl border-2 border-hairline bg-paper p-6 text-center text-lg font-medium shadow-[0_14px_28px_-22px_color-mix(in_srgb,var(--ink)_45%,transparent)] select-none",
              isSwipe && "cursor-grab touch-pan-y active:cursor-grabbing",
              !drag && "transition-transform duration-200",
              missed && missedClassName,
            )}
          >
            {current.text}
          </div>
          {/* Swipe sides are physical, so their buttons keep left and right in both directions. */}
          <div
            dir={isSwipe ? "ltr" : undefined}
            className={cn("grid gap-2", groups.length === 3 ? "sm:grid-cols-3" : "grid-cols-2")}
          >
            {groups.map((group, index) => (
              <button
                key={group.id}
                type="button"
                onClick={() => place(group.id)}
                className={cn(optionClassName, "justify-center text-center")}
              >
                {isSwipe && index === 0 && <ArrowLeft aria-hidden className="size-4 shrink-0" />}
                <span dir="auto">{group.label}</span>
                {isSwipe && index === 1 && <ArrowRight aria-hidden className="size-4 shrink-0" />}
              </button>
            ))}
          </div>
          {missed && (
            <Feedback tone="retry" quote={hints ? current.sourceQuote : undefined}>
              {t("tryOtherGroup")}
            </Feedback>
          )}
        </>
      )}

      <div
        dir={isSwipe ? "ltr" : undefined}
        className={cn("grid gap-2", groups.length === 3 ? "sm:grid-cols-3" : "grid-cols-2")}
      >
        {groups.map((group) => (
          <section
            dir="auto"
            key={group.id}
            aria-label={group.label}
            className="rounded-xl border border-dashed border-hairline bg-sand/60 p-3"
          >
            <h4 className="text-sm font-semibold">
              {group.label} <span className="text-muted-foreground">({placedIn(group.id).length})</span>
            </h4>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {placedIn(group.id).map((item) => (
                <li key={item.id} className="animate-rise-in rounded-full bg-oasis/10 px-2.5 py-1 text-sm">
                  {item.text}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
