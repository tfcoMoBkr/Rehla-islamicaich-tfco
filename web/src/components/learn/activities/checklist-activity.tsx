"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Feedback } from "@/components/learn/feedback";
import { optionClassName } from "@/components/learn/interactions/option-styles";
import { Button } from "@/components/ui/button";
import { progressActions, useProgress } from "@/lib/learn/progress-store";
import type { ActivityView } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type ChecklistActivityProps = {
  activity: Extract<ActivityView, { type: "checklist" }>;
  lessonId: string;
  onComplete: () => void;
};

/**
 * A personal list kept on this device only, or (in quiz mode) "tick the right ones", checked
 * when the learner asks and never penalised.
 */
export function ChecklistActivity({ activity, lessonId, onComplete }: ChecklistActivityProps) {
  const t = useTranslations("Activity");
  const progress = useProgress();
  const [quizTicks, setQuizTicks] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const key = `${lessonId}:${activity.id}`;
  const ticks = activity.quiz ? quizTicks : (progress.checklists[key] ?? []);

  function toggle(itemId: string) {
    const next = ticks.includes(itemId) ? ticks.filter((id) => id !== itemId) : [...ticks, itemId];
    if (activity.quiz) {
      setQuizTicks(next);
      setChecked(false);
    } else {
      progressActions.setChecklist(key, next);
    }
  }

  const rightIds = activity.items.filter((item) => item.correct).map((item) => item.id);
  const allRight = rightIds.length === ticks.length && rightIds.every((id) => ticks.includes(id));

  return (
    <fieldset className="grid gap-3">
      <legend className="sr-only">{activity.title}</legend>
      {!activity.quiz && (
        <p className="text-sm text-muted-foreground">{t("checklistCount", { done: ticks.length, total: activity.items.length })}</p>
      )}
      {activity.items.map((item) => {
        const ticked = ticks.includes(item.id);
        const verdict = checked && activity.quiz ? (item.correct === ticked ? "right" : "wrong") : null;
        return (
          <label
            key={item.id}
            className={cn(
              optionClassName,
              "cursor-pointer has-checked:border-oasis/60 has-checked:bg-oasis/8 has-focus-visible:outline-2 has-focus-visible:outline-ring",
              verdict === "wrong" && "border-dawn",
            )}
          >
            <input
              type="checkbox"
              checked={ticked}
              onChange={() => toggle(item.id)}
              className="size-5 shrink-0 accent-oasis-text focus-visible:outline-none"
            />
            <span className="min-w-0 flex-1">{item.text}</span>
            {verdict === "right" && item.correct && <Check aria-hidden className="size-5 text-oasis-text" />}
          </label>
        );
      })}
      {activity.quiz && (
        <>
          {checked && (
            <Feedback tone={allRight ? "right" : "retry"}>{allRight ? t("allRight") : t("lookAgain")}</Feedback>
          )}
          <Button
            variant="outline"
            className="justify-self-start"
            disabled={ticks.length === 0}
            onClick={() => {
              setChecked(true);
              if (allRight) onComplete();
            }}
          >
            {t("checkTicks")}
          </Button>
        </>
      )}
      {!activity.quiz && <p className="text-sm text-muted-foreground">{t("deviceOnly")}</p>}
    </fieldset>
  );
}
