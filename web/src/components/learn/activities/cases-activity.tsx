"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { StepDots } from "@/components/learn/assessment/step-dots";
import { Feedback } from "@/components/learn/feedback";
import { optionClassName } from "@/components/learn/interactions/option-styles";
import { Button } from "@/components/ui/button";
import type { ActivityView } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type CasesActivityProps = {
  activity: Extract<ActivityView, { type: "selectCases" }>;
  onComplete: (mistakes: number) => void;
  /** Called with how many steps are done, after each one. */
  onProgress?: (done: number) => void;
};

/** One case per screen, each with its own small set of answers. */
export function CasesActivity({ activity, onComplete, onProgress }: CasesActivityProps) {
  const t = useTranslations("Activity");
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const entry = activity.cases[index];
  if (!entry) return null;

  const right = picked === entry.answer;
  const last = index === activity.cases.length - 1;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          {t("caseOf", { current: index + 1, total: activity.cases.length })}
        </p>
        <StepDots total={activity.cases.length} current={index} />
      </div>
      <p className="text-lg font-semibold">{entry.prompt}</p>
      <div className="grid grid-cols-3 gap-2">
        {entry.options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={right}
            aria-pressed={picked === option}
            onClick={() => {
              setPicked(option);
              if (option === entry.answer) onProgress?.(index + 1);
              else setMistakes((count) => count + 1);
            }}
            className={cn(optionClassName, "justify-center text-center text-xl")}
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
