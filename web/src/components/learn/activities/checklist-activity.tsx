"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRafiqReaction } from "@/components/learn/board/rafiq-context";
import { Feedback } from "@/components/learn/feedback";
import { DragHandle } from "@/components/learn/interactions/drag-handle";
import { optionClassName } from "@/components/learn/interactions/option-styles";
import { useDragDrop } from "@/components/learn/interactions/use-drag-drop";
import { Button } from "@/components/ui/button";
import { progressActions, useProgress } from "@/lib/learn/progress-store";
import type { ActivityView } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type ChecklistActivityProps = {
  activity: Extract<ActivityView, { type: "checklist" }>;
  lessonId: string;
  onComplete: () => void;
  /** Called with how many steps are done, after each one. */
  onProgress?: (done: number) => void;
};

/**
 * A personal list kept on this device only, or (in quiz mode) "tick the right ones", checked
 * when the learner asks and never penalised. An item is ticked by tapping it or dragging it
 * into the ticked space above the list.
 */
export function ChecklistActivity({ activity, lessonId, onComplete, onProgress }: ChecklistActivityProps) {
  const t = useTranslations("Activity");
  const progress = useProgress();
  const react = useRafiqReaction();
  const [quizTicks, setQuizTicks] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const key = `${lessonId}:${activity.id}`;
  const ticks = activity.quiz ? quizTicks : (progress.checklists[key] ?? []);
  const { itemProps, targetProps } = useDragDrop((itemId) => {
    if (!ticks.includes(itemId)) toggle(itemId);
  });

  function toggle(itemId: string) {
    const next = ticks.includes(itemId) ? ticks.filter((id) => id !== itemId) : [...ticks, itemId];
    if (activity.quiz) {
      setQuizTicks(next);
      setChecked(false);
      react("thinking");
    } else {
      progressActions.setChecklist(key, next);
      onProgress?.(next.length);
      if (next.length > ticks.length) react("pleased");
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
      <div
        {...targetProps("ticked")}
        className="grid min-h-16 content-start gap-2 rounded-xl border-2 border-dashed border-border p-3 transition-colors data-drop-over:border-primary data-drop-over:bg-primary/10"
      >
        <p className="text-sm text-muted-foreground">{t("tickZone")}</p>
        {ticks.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {activity.items
              .filter((item) => ticks.includes(item.id))
              .map((item) => (
                <li key={item.id} className="animate-rise-in rounded-full bg-success/12 px-2.5 py-1 text-sm">
                  {item.text}
                </li>
              ))}
          </ul>
        )}
      </div>
      {activity.items.map((item) => {
        const ticked = ticks.includes(item.id);
        const verdict = checked && activity.quiz ? (item.correct === ticked ? "right" : "wrong") : null;
        return (
          <label
            key={item.id}
            {...(ticked ? {} : itemProps(item.id))}
            className={cn(
              optionClassName,
              "cursor-pointer has-checked:border-success/60 has-checked:bg-success/8 has-focus-visible:outline-2 has-focus-visible:outline-ring data-dragging:shadow-lg",
              verdict === "wrong" && "border-dawn",
            )}
          >
            {!ticked && <DragHandle />}
            <input
              type="checkbox"
              checked={ticked}
              onChange={() => toggle(item.id)}
              className="size-5 shrink-0 accent-success focus-visible:outline-none"
            />
            <span className="min-w-0 flex-1">{item.text}</span>
            {verdict === "right" && item.correct && <Check aria-hidden className="size-5 text-success" />}
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
              react(allRight ? "pleased" : "encouraging");
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
