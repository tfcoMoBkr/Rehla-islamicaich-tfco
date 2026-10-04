"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { StepDots } from "@/components/learn/assessment/step-dots";
import { useRafiqReaction } from "@/components/learn/board/rafiq-context";
import { Feedback } from "@/components/learn/feedback";
import { DragHandle } from "@/components/learn/interactions/drag-handle";
import { optionClassName } from "@/components/learn/interactions/option-styles";
import { useDragDrop } from "@/components/learn/interactions/use-drag-drop";
import { Button } from "@/components/ui/button";
import type { ActivityView } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type CasesActivityProps = {
  activity: Extract<ActivityView, { type: "selectCases" }>;
  onComplete: (mistakes: number) => void;
  /** Called with how many steps are done, after each one. */
  onProgress?: (done: number) => void;
};

/** One case per screen, each with its own small set of answers: tap an answer, or drag the case onto it. */
export function CasesActivity({ activity, onComplete, onProgress }: CasesActivityProps) {
  const t = useTranslations("Activity");
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const react = useRafiqReaction();
  const entry = activity.cases[index];
  const right = entry !== undefined && picked === entry.answer;
  const { itemProps, targetProps } = useDragDrop((_, option) => pick(option));

  function pick(option: string) {
    if (!entry || right) return;
    setPicked(option);
    if (option === entry.answer) {
      onProgress?.(index + 1);
      react("pleased");
    } else {
      setMistakes((count) => count + 1);
      react("encouraging");
    }
  }

  if (!entry) return null;
  const last = index === activity.cases.length - 1;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          {t("caseOf", { current: index + 1, total: activity.cases.length })}
        </p>
        <StepDots total={activity.cases.length} current={index} />
      </div>
      <div
        {...(right ? {} : itemProps(entry.prompt))}
        className="flex items-start gap-2 rounded-2xl border-2 border-border bg-card p-4 text-lg font-semibold text-card-foreground data-dragging:shadow-lg"
      >
        {!right && <DragHandle />}
        <p className="min-w-0 flex-1">{entry.prompt}</p>
      </div>
      {!right && <p className="text-sm text-muted-foreground">{t("dragToAnswer")}</p>}
      <div className="grid grid-cols-3 gap-2">
        {entry.options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={right}
            aria-pressed={picked === option}
            onClick={() => pick(option)}
            {...targetProps(option)}
            className={cn(optionClassName, "justify-center text-center text-xl data-drop-over:border-primary data-drop-over:bg-primary/10")}
          >
            {option}
          </button>
        ))}
      </div>
      {picked && <Feedback tone={right ? "right" : "retry"}>{right ? t("rightCase") : t("tryAnother")}</Feedback>}
      {right && !last && (
        <Button
          className="justify-self-start"
          onClick={() => {
            setIndex(index + 1);
            setPicked(null);
          }}
        >
          {t("nextCase")}
        </Button>
      )}
      {right && last && (
        <Button className="justify-self-start" variant="outline" onClick={() => onComplete(mistakes)}>
          {t("allCasesDone")}
        </Button>
      )}
    </div>
  );
}
