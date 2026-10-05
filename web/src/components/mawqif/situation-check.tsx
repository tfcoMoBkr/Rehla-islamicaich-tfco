"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ItemView, SituationCheckView } from "@/lib/mawqif/types";
import { cn } from "@/lib/utils";

import { Parts, QuoteCard, SourceInFull } from "./quote";

/**
 * Questions one at a time. After each answer the right one is shown with its source; a wrong
 * answer costs nothing and is never scolded. `onDone` receives the first answers' score.
 */
export function SituationCheck({
  checks,
  items,
  onAnswer,
  onDone,
  label,
}: {
  checks: readonly SituationCheckView[];
  items: readonly ItemView[];
  onAnswer: (checkId: string, correct: boolean, index: number) => void;
  onDone: (correct: number, total: number) => void;
  /** Over each question, for example the situation it comes from in a final test. */
  label?: (index: number) => string;
}) {
  const t = useTranslations("Mawqif");
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const check = checks[index]!;
  const right = check.options.find((option) => option.correct)!;
  const answered = picked !== null;
  const wasRight = picked === right.id;
  const sourceRef = right.part.kind === "quote" ? right.part.quote.ref : null;
  const item = items.find((candidate) => candidate.id === sourceRef);

  function pick(id: string) {
    if (answered) return;
    const isRight = id === right.id;
    setPicked(id);
    if (isRight) setCorrect((count) => count + 1);
    onAnswer(check.id, isRight, index);
  }

  function next() {
    if (index + 1 < checks.length) {
      setIndex(index + 1);
      setPicked(null);
    } else onDone(correct, checks.length);
  }

  return (
    <fieldset className="grid gap-4">
      <legend className="grid gap-1">
        <span className="text-sm text-muted-foreground">
          {label ? `${label(index)} · ` : ""}
          {t("questionOf", { number: index + 1, total: checks.length })}
        </span>
        <span className="font-display text-xl font-semibold">{check.prompt}</span>
      </legend>
      <ul className="grid gap-2">
        {check.options.map((option) => {
          const chosen = picked === option.id;
          return (
            <li key={option.id}>
              <button
                type="button"
                aria-pressed={chosen}
                disabled={answered && !chosen && !option.correct}
                onClick={() => pick(option.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border-2 bg-paper px-4 py-3 text-start text-lg leading-relaxed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  !answered && "border-hairline hover:border-dawn",
                  answered && option.correct && "border-oasis bg-oasis/8",
                  answered && chosen && !option.correct && "border-terracotta/60",
                  answered && !chosen && !option.correct && "border-hairline opacity-60",
                )}
              >
                {answered && option.correct && <Check aria-hidden className="mt-1.5 size-5 shrink-0 text-oasis-text" />}
                {answered && chosen && !option.correct && <X aria-hidden className="mt-1.5 size-5 shrink-0 text-terracotta-text" />}
                <Parts parts={[option.part]} />
              </button>
            </li>
          );
        })}
      </ul>
      {answered && (
        <div role="status" className="grid gap-3">
          <p className="font-semibold">{wasRight ? t("rightAnswer") : t("notQuite")}</p>
          {right.part.kind === "quote" && <QuoteCard quote={right.part.quote} />}
          {item && <SourceInFull item={item} />}
          <Button className="justify-self-start" onClick={next}>
            {index + 1 < checks.length ? t("nextQuestion") : t("seeResult")}
          </Button>
        </div>
      )}
    </fieldset>
  );
}
