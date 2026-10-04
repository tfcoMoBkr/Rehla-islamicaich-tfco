"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { TeamWordingLabel } from "@/components/learn/wording";

import { StepDots } from "@/components/learn/assessment/step-dots";
import { LineHelpButton } from "@/components/learn/board/line-help-button";
import { useRafiqReaction } from "@/components/learn/board/rafiq-context";
import { ListenControls } from "@/components/learn/audio/listen-controls";
import { MediaGallery } from "@/components/learn/media-gallery";
import { Button } from "@/components/ui/button";
import { splitSentences, useReadAloud } from "@/lib/audio/speech";
import type { GuidedStep } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type GuidedWalkProps = {
  steps: readonly GuidedStep[];
  note: string | null;
  onFinish: () => void;
  /** Called with how many steps are done, after each one. */
  onProgress?: (done: number) => void;
  /** "I didn't understand" for one line of a step. */
  onLineHelp?: (line: string, stepId: string) => void;
};

/** "Do it with me": one step per screen, at the learner's pace, one line of it at a time. */
export function GuidedWalk({ steps, note, onFinish, onProgress, onLineHelp }: GuidedWalkProps) {
  const t = useTranslations("Activity");
  const locale = useLocale();
  const [index, setIndex] = useState(0);
  const react = useRafiqReaction();
  const step = steps[index];
  // Read aloud: the step's title and text. The words to say (`say`) are not read by a synthetic voice.
  const sentences = useMemo(() => (step ? splitSentences(step.text) : []), [step]);
  const segments = useMemo(() => (step?.title ? [step.title, ...sentences] : sentences), [step, sentences]);
  const reader = useReadAloud(segments, locale);
  if (!step) return null;
  const last = index === steps.length - 1;
  const offset = step.title ? 1 : 0;
  const lit = (position: number) =>
    cn("decoration-dawn decoration-2 underline-offset-[0.4em]", reader.current === position && "underline");

  return (
    <div className="grid gap-5">
      {note && index === 0 && <p className="text-muted-foreground">{note}</p>}
      <div className="grid gap-5 rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">
            {t("stepOf", { current: index + 1, total: steps.length })}
          </p>
          <StepDots total={steps.length} current={index} />
        </div>
        <div aria-live="polite" className="grid gap-3">
          {step.title && <p className={cn("text-xl leading-snug font-semibold", lit(0))}>{step.title}</p>}
          <div className="grid gap-2 text-lg leading-relaxed">
            {sentences.map((sentence, position) => (
              <p key={`${position}-${sentence}`} className="flex items-start gap-1">
                <span className={cn("min-w-0 flex-1", lit(position + offset))}>{sentence}</span>
                {onLineHelp && <LineHelpButton onOpen={() => onLineHelp(sentence, step.id)} />}
              </p>
            ))}
          </div>
          <TeamWordingLabel wording={step.wording} />
          <ListenControls reader={reader} />
          <MediaGallery media={step.media} />
          {step.repeat && (
            <p className="justify-self-start rounded-full bg-dawn/15 px-3 py-1 text-sm font-semibold">
              {t(`repeat.${step.repeat as "once" | "onceOnly" | "onceRequiredThreeRecommended" | "three"}`)}
            </p>
          )}
          {step.say && (
            <p lang="ar" dir="rtl" className="rounded-xl border-s-4 border-dawn bg-muted px-4 py-3 font-display text-2xl leading-loose">
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
          <Button
            onClick={() => {
              onProgress?.(index + 1);
              react("pleased");
              if (last) onFinish();
              else setIndex(index + 1);
            }}
          >
            {last ? t("finishWalk") : t("nextStep")}
          </Button>
        </div>
      </div>
    </div>
  );
}
