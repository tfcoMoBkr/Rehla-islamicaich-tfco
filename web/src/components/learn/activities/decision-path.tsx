"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Feedback } from "@/components/learn/feedback";
import { SourceLinks } from "@/components/learn/source-links";
import { Button } from "@/components/ui/button";
import type { ActivityView } from "@/lib/learn/types";

type DecisionPathProps = {
  activity: Extract<ActivityView, { type: "decisionPath" }>;
  onComplete: () => void;
};

/** Yes/no questions, one at a time. An answer with its own advice stops the path there. */
export function DecisionPath({ activity, onComplete }: DecisionPathProps) {
  const t = useTranslations("Activity");
  const [index, setIndex] = useState(0);
  const [stop, setStop] = useState<string | null>(null);
  const step = activity.steps[index];
  const reachedEnd = index >= activity.steps.length;

  function answer(choice: "yes" | "no") {
    if (!step) return;
    const advice = step[choice];
    if (advice) {
      setStop(advice);
      return;
    }
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
          <li key={entry.id} className={position < index ? "h-1.5 flex-1 rounded-full bg-dawn" : "h-1.5 flex-1 rounded-full bg-hairline"} />
        ))}
      </ol>
      {step && <p className="text-xl font-semibold">{step.question}</p>}
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
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" variant="outline" onClick={() => answer("yes")}>
            {t("yes")}
          </Button>
          <Button size="lg" variant="outline" onClick={() => answer("no")}>
            {t("no")}
          </Button>
        </div>
      )}
    </div>
  );
}
