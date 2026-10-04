"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { StepDots } from "@/components/learn/assessment/step-dots";
import { Button } from "@/components/ui/button";
import type { GuidedStep } from "@/lib/learn/types";

type GuidedWalkProps = {
  steps: readonly GuidedStep[];
  note: string | null;
  onFinish: () => void;
};

/** "Do it with me": one step per screen, at the learner's pace. */
export function GuidedWalk({ steps, note, onFinish }: GuidedWalkProps) {
  const t = useTranslations("Activity");
  const [index, setIndex] = useState(0);
  const step = steps[index];
  if (!step) return null;
  const last = index === steps.length - 1;

  return (
    <div className="grid gap-5">
      {note && index === 0 && <p className="text-muted-foreground">{note}</p>}
      <div className="grid gap-5 rounded-2xl border border-hairline bg-paper p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">
            {t("stepOf", { current: index + 1, total: steps.length })}
          </p>
          <StepDots total={steps.length} current={index} />
        </div>
        <div aria-live="polite" className="grid gap-3">
          {step.title && <p className="font-display text-2xl leading-snug font-semibold">{step.title}</p>}
          <p className="text-lg leading-relaxed">{step.text}</p>
          {step.repeat && (
            <p className="justify-self-start rounded-full bg-dawn/15 px-3 py-1 text-sm font-semibold">
              {t(`repeat.${step.repeat as "once" | "onceOnly" | "onceRequiredThreeRecommended" | "three"}`)}
            </p>
          )}
          {step.say && (
            <p lang="ar" dir="rtl" className="rounded-xl border-s-4 border-dawn bg-sand px-4 py-3 font-display text-2xl leading-loose">
              {step.say}
            </p>
          )}
          {step.citation && (
            <p className="text-sm text-muted-foreground">
              {t("reference")}: <span lang="ar">{step.citation}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {index > 0 && (
            <Button variant="outline" onClick={() => setIndex(index - 1)}>
              {t("previousStep")}
            </Button>
          )}
          <Button onClick={() => (last ? onFinish() : setIndex(index + 1))}>
            {last ? t("finishWalk") : t("nextStep")}
          </Button>
        </div>
      </div>
    </div>
  );
}
