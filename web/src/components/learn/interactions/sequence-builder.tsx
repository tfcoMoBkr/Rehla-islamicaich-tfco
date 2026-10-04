"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useRafiqReaction } from "@/components/learn/board/rafiq-context";
import { Feedback } from "@/components/learn/feedback";
import { stableShuffle } from "@/lib/learn/shuffle";
import { cn } from "@/lib/utils";

import { DragHandle } from "./drag-handle";
import { missedClassName, optionClassName } from "./option-styles";
import { useDragDrop } from "./use-drag-drop";

type Item = { id: string; text: string; sourceQuote?: string; label?: string };

type SequenceBuilderProps = {
  /** In their correct order. */
  items: readonly Item[];
  seed: string;
  /** `road` lays the placed items along a stretch of road, for timelines. */
  variant?: "list" | "road";
  /** After a wrong tap, quote the lesson sentence for the step that comes next. */
  hints?: boolean;
  onComplete: (mistakes: number) => void;
  /** Called with how many steps are done, after each one. */
  onProgress?: (done: number) => void;
};

/** Build a sequence one step at a time, "which comes next?": tap an item or drag it to the next place. */
export function SequenceBuilder({ items, seed, variant = "list", hints = true, onComplete, onProgress }: SequenceBuilderProps) {
  const t = useTranslations("Activity");
  const pool = useMemo(() => stableShuffle(items, seed), [items, seed]);
  const [placed, setPlaced] = useState<string[]>([]);
  const [missed, setMissed] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const react = useRafiqReaction();
  const { itemProps, targetProps } = useDragDrop((id, target) => {
    const item = items.find((candidate) => candidate.id === id);
    if (item && target === "next") choose(item);
  });

  const expected = items[placed.length];
  const done = placed.length === items.length;

  function choose(item: Item) {
    if (!expected) return;
    if (item.id !== expected.id) {
      setMistakes((count) => count + 1);
      setMissed(item.id);
      react("encouraging");
      return;
    }
    const next = [...placed, item.id];
    setPlaced(next);
    setMissed(null);
    react("pleased");
    onProgress?.(next.length);
    if (next.length === items.length) onComplete(mistakes);
  }

  const isRoad = variant === "road";

  return (
    <div className="grid gap-6">
      <ol
        aria-label={t("yourOrder")}
        className={cn("grid gap-2", isRoad && "relative gap-4 border-s-2 border-dashed border-dawn ps-6")}
      >
        {items.slice(0, placed.length).map((item, index) => (
          <li
            key={item.id}
            className={cn(
              "animate-rise-in flex items-center gap-3 rounded-xl bg-success/8 px-4 py-3 font-medium",
              isRoad && "relative before:absolute before:-start-[2.05rem] before:top-1/2 before:size-4 before:-translate-y-1/2 before:rounded-full before:border-2 before:border-background before:bg-dawn",
            )}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-success text-sm text-background">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">{item.text}</span>
            {item.label && <span className="shrink-0 text-sm text-muted-foreground" dir="ltr">{item.label}</span>}
          </li>
        ))}
        {!done && (
          <li
            aria-hidden
            {...targetProps("next")}
            className="rounded-xl border-2 border-dashed border-border px-4 py-3 text-muted-foreground transition-colors data-drop-over:border-primary data-drop-over:bg-primary/10"
          >
            {t("nextSlot", { number: placed.length + 1 })}
          </li>
        )}
      </ol>

      {!done && (
        <div className="grid gap-3">
          <p className="font-semibold">{t("whichNext")}</p>
          <ul className="grid gap-2">
            {pool
              .filter((item) => !placed.includes(item.id))
              .map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => choose(item)}
                    {...itemProps(item.id)}
                    className={cn(optionClassName, "data-dragging:shadow-lg", missed === item.id && missedClassName)}
                  >
                    <DragHandle />
                    <span className="min-w-0 flex-1">{item.text}</span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}

      {missed && !done && (
        <Feedback tone="retry" quote={hints ? expected?.sourceQuote : undefined}>
          {t("notNextYet")}
        </Feedback>
      )}
      <p aria-live="polite" className="sr-only">
        {placed.length > 0 && t("placedCount", { placed: placed.length, total: items.length })}
      </p>
    </div>
  );
}
