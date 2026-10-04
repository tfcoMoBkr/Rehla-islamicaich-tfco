"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useRafiqReaction } from "@/components/learn/board/rafiq-context";
import { Feedback } from "@/components/learn/feedback";
import { Lantern } from "@/components/journey/lantern";
import { stableShuffle } from "@/lib/learn/shuffle";
import { cn } from "@/lib/utils";

import { DragHandle } from "./drag-handle";
import { missedClassName, optionClassName, placedClassName } from "./option-styles";
import { useDragDrop } from "./use-drag-drop";

type Pair = { id: string; left: string; right: string; sourceQuote?: string };

type MatchBoardProps = {
  pairs: readonly Pair[];
  seed: string;
  /** `lanterns` lights a lantern beside each item once it is matched. */
  style?: "plain" | "lanterns";
  /** Several items share one answer (e.g. three prayers of four rak'ahs): the answer is shown once. */
  repeatedRight?: boolean;
  /** The left column is Quran text. */
  leftIsQuran?: boolean;
  hints?: boolean;
  onComplete: (mistakes: number) => void;
  /** Called with how many steps are done, after each one. */
  onProgress?: (done: number) => void;
};

/** Tap an item, then the one it goes with; or drag the item onto it. */
export function MatchBoard({
  pairs,
  seed,
  style = "plain",
  repeatedRight = false,
  leftIsQuran = false,
  hints = true,
  onComplete,
  onProgress,
}: MatchBoardProps) {
  const t = useTranslations("Activity");
  const answers = useMemo(() => {
    const shuffled = stableShuffle(pairs, `${seed}:right`);
    if (!repeatedRight) return shuffled.map((pair) => ({ key: pair.id, text: pair.right, ids: [pair.id] }));
    const byText = new Map<string, string[]>();
    for (const pair of shuffled) byText.set(pair.right, [...(byText.get(pair.right) ?? []), pair.id]);
    return [...byText].map(([text, ids]) => ({ key: ids.join("+"), text, ids }));
  }, [pairs, seed, repeatedRight]);
  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [missed, setMissed] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const react = useRafiqReaction();
  const { itemProps, targetProps } = useDragDrop((pairId, answerKey) => {
    const answer = answers.find((candidate) => candidate.key === answerKey);
    setSelected(pairId);
    if (answer) choose(answer, pairId);
  });

  const selectedPair = pairs.find((pair) => pair.id === selected);
  const done = matched.length === pairs.length;

  function choose(answer: (typeof answers)[number], pairId = selected) {
    if (!pairId || matched.includes(pairId)) return;
    if (!answer.ids.includes(pairId)) {
      setMistakes((count) => count + 1);
      setMissed(answer.key);
      react("encouraging");
      return;
    }
    const next = [...matched, pairId];
    setMatched(next);
    onProgress?.(next.length);
    setSelected(null);
    setMissed(null);
    react("pleased");
    if (next.length === pairs.length) onComplete(mistakes);
  }

  return (
    <div className="grid gap-5">
      <p className="text-muted-foreground">{done ? t("allMatched") : t("matchHint")}</p>
      <div className="grid grid-cols-2 gap-3">
        <ul className="grid content-start gap-2" aria-label={t("matchLeft")}>
          {pairs.map((pair) => {
            const isMatched = matched.includes(pair.id);
            return (
              <li key={pair.id}>
                <button
                  type="button"
                  disabled={isMatched}
                  aria-pressed={selected === pair.id}
                  onClick={() => {
                    setSelected(pair.id);
                    setMissed(null);
                    react("thinking");
                  }}
                  {...(isMatched ? {} : itemProps(pair.id))}
                  className={cn(optionClassName, "min-h-16 data-dragging:shadow-lg", isMatched && placedClassName)}
                >
                  {!isMatched && <DragHandle />}
                  {style === "lanterns" && <Lantern lit={isMatched} className="size-7 shrink-0 text-foreground" />}
                  <span
                    lang={leftIsQuran ? "ar" : undefined}
                    dir={leftIsQuran ? "rtl" : undefined}
                    className={cn("min-w-0 flex-1", leftIsQuran && "font-quran text-xl leading-loose")}
                  >
                    {pair.left}
                  </span>
                  {isMatched && <MatchedMark />}
                </button>
              </li>
            );
          })}
        </ul>
        <ul className="grid content-start gap-2" aria-label={t("matchRight")}>
          {answers.map((answer) => {
            const isMatched = answer.ids.every((id) => matched.includes(id));
            return (
              <li key={answer.key}>
                <button
                  type="button"
                  disabled={isMatched || !selected}
                  onClick={() => choose(answer)}
                  {...targetProps(answer.key)}
                  className={cn(
                    optionClassName,
                    "min-h-16 data-drop-over:border-primary data-drop-over:bg-primary/10",
                    isMatched && placedClassName,
                    missed === answer.key && missedClassName,
                    !selected && !isMatched && "opacity-70",
                  )}
                >
                  <span className="min-w-0 flex-1">{answer.text}</span>
                  {isMatched && <MatchedMark />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {missed && selectedPair && (
        <Feedback tone="retry" quote={hints ? selectedPair.sourceQuote : undefined}>
          {t("notThisPair")}
        </Feedback>
      )}
      <p aria-live="polite" className="sr-only">
        {matched.length > 0 && t("matchedCount", { matched: matched.length, total: pairs.length })}
      </p>
    </div>
  );
}

function MatchedMark() {
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-success text-background">
      <Check aria-hidden className="size-3.5" />
    </span>
  );
}
