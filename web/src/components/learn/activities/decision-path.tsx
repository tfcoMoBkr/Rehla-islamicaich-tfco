"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRafiqReaction } from "@/components/learn/board/rafiq-context";
import { Feedback } from "@/components/learn/feedback";
import { DragHandle } from "@/components/learn/interactions/drag-handle";
import { useDragDrop } from "@/components/learn/interactions/use-drag-drop";
import { SourceLinks } from "@/components/learn/source-links";
import { Button } from "@/components/ui/button";
import type { ActivityView } from "@/lib/learn/types";

type DecisionPathProps = {
  activity: Extract<ActivityView, { type: "decisionPath" }>;
  onComplete: () => void;
  /** Called with how many steps are done, after each one. */
  onProgress?: (done: number) => void;
};

/**
 * Yes/no questions, one at a time: tap Yes or No, or drag the question onto one. An answer with
 * its own advice stops the path there.
 */
export function DecisionPath({ activity, onComplete, onProgress }: DecisionPathProps) {
  const t = useTranslations("Activity");
  const [index, setIndex] = useState(0);
  const [stop, setStop] = useState<string | null>(null);
  const react = useRafiqReaction();
  const { itemProps, targetProps } = useDragDrop((_, choice) => {
    if (choice === "yes" || choice === "no") answer(choice);
  });
  const step = activity.steps[index];
  const reachedEnd = index >= activity.steps.length;

  function answer(choice: "yes" | "no") {
    if (!step) return;
    const advice = step[choice];
    if (advice) {
      setStop(advice);
      react("thinking");
      return;
    }
    onProgress?.(index + 1);
    react("pleased");
    if (index + 1 >= activity.steps.length) onComplete();
    setIndex(index + 1);
  }

  if (reachedEnd) {
    return (
      <div className="grid gap-4">
        <Feedback tone="right">{activity.end}</Feedback>
        <SourceLinks sources={activity.sources} />
        <Button variant="outline" className="justify-self-start" onClick={() => setIndex(0)}>
          {t("startAgain")}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <ol aria-hidden className="flex gap-1.5">
        {activity.steps.map((entry, position) => (
          <li key={entry.id} className={position < index ? "h-1.5 flex-1 rounded-full bg-dawn" : "h-1.5 flex-1 rounded-full bg-border"} />
        ))}
      </ol>
      {step && (
        <div
          {...(stop ? {} : itemProps(step.id))}
          className="flex items-start gap-2 rounded-2xl border-2 border-border bg-card p-4 text-card-foreground data-dragging:shadow-lg"
        >
          {!stop && <DragHandle />}
          <p className="min-w-0 flex-1 text-xl font-semibold">{step.question}</p>
        </div>
      )}
      {stop ? (
        <>
          <Feedback tone="retry">{stop}</Feedback>
          <SourceLinks sources={activity.sources} />
          <Button
            variant="outline"
            className="justify-self-start"
            onClick={() => {
              setStop(null);
              setIndex(0);
            }}
          >
            {t("startAgain")}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{t("dragToAnswer")}</p>
          <div className="grid grid-cols-2 gap-2">
            {(["yes", "no"] as const).map((choice) => (
              <Button
                key={choice}
                size="lg"
                variant="outline"
                onClick={() => answer(choice)}
                {...targetProps(choice)}
                className="data-drop-over:border-primary data-drop-over:bg-primary/10"
              >
                {t(choice)}
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
