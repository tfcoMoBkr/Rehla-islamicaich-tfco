"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useRafiqReaction } from "@/components/learn/board/rafiq-context";
import { Feedback } from "@/components/learn/feedback";
import { optionClassName, placedClassName } from "@/components/learn/interactions/option-styles";
import { Lantern } from "@/components/journey/lantern";
import { stableShuffle } from "@/lib/learn/shuffle";
import type { ActivityView } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type SelectActivityProps = {
  activity: Extract<ActivityView, { type: "select" }>;
  seed: string;
  onComplete: (mistakes: number) => void;
  /** Called with how many steps are done, after each one. */
  onProgress?: (done: number) => void;
};

/**
 * Find every right answer among the items. `fiveLanterns` lights one lantern per find;
 * `collect` gathers what was found. A wrong pick costs nothing; it just says why.
 */
export function SelectActivity({ activity, seed, onComplete, onProgress }: SelectActivityProps) {
  const t = useTranslations("Activity");
  const items = useMemo(() => stableShuffle(activity.items, seed), [activity.items, seed]);
  const target = activity.items.filter((item) => item.correct).length;
  const [found, setFound] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string[]>([]);
  const [lastWrong, setLastWrong] = useState<string | null>(null);
  const react = useRafiqReaction();

  function choose(item: (typeof items)[number]) {
    if (!item.correct) {
      setWrong((current) => (current.includes(item.id) ? current : [...current, item.id]));
      setLastWrong(item.id);
      react("encouraging");
      return;
    }
    const next = [...found, item.id];
    setFound(next);
    setLastWrong(null);
    react("pleased");
    onProgress?.(next.length);
    if (next.length === target) onComplete(wrong.length);
  }

  return (
    <div className="grid gap-5">
      {activity.visual === "fiveLanterns" && (
        <div className="tone-night flex justify-center gap-2 rounded-2xl bg-background px-4 py-5" aria-hidden>
          {Array.from({ length: target }, (_, index) => (
            <Lantern key={index} lit={index < found.length} className="size-10 text-sand sm:size-12" />
          ))}
        </div>
      )}
      {activity.visual === "collect" && found.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={t("collected")}>
          {found.map((id) => (
            <li key={id} className="animate-rise-in rounded-full bg-success/12 px-3 py-1.5 text-sm font-medium text-success">
              {activity.items.find((item) => item.id === id)?.text}
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("foundCount", { found: found.length, total: target })}
      </p>
      <ul className="grid gap-2">
        {items.map((item) => {
          const isFound = found.includes(item.id);
          const isWrong = wrong.includes(item.id);
          return (
            <li key={item.id}>
              <button
                type="button"
                disabled={isFound || isWrong}
                onClick={() => choose(item)}
                className={cn(optionClassName, isFound && placedClassName, isWrong && "border-dashed text-muted-foreground")}
              >
                <span className="min-w-0 flex-1">{item.text}</span>
                {isFound && <Check aria-hidden className="size-5 text-success" />}
              </button>
            </li>
          );
        })}
      </ul>
      {lastWrong && <Feedback tone="retry">{activity.feedbackWrong ?? t("notOneOfThem")}</Feedback>}
    </div>
  );
}
