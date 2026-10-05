"use client";

import { Check, Phone } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Stamp } from "@/components/journey/stamp";
import { StationMarker } from "@/components/journey/station";
import { ChalkBoard } from "@/components/learn/board/chalk-board";
import { Feedback } from "@/components/learn/feedback";
import { SituationArt } from "@/components/mawqif/situation-art";
import { RafiqFigure } from "@/components/rafiq/rafiq-figure";
import { useReferralCentres } from "@/components/specialists/centres-context";
import { Button } from "@/components/ui/button";
import { features } from "@/config/features";
import { Link } from "@/i18n/navigation";
import { closeGuide } from "@/lib/guide-store";
import type { TourSample } from "@/lib/learn/tour";
import { nationalChannels } from "@/lib/referral/centres";
import { cn } from "@/lib/utils";

// The working previews load only when their step is reached.
const SequenceBuilder = dynamic(() => import("@/components/learn/interactions/sequence-builder").then((module) => module.SequenceBuilder));
const QuestionCard = dynamic(() => import("@/components/learn/questions/question-card").then((module) => module.QuestionCard));

const STEPS = ["road", "class", "hands", "question", "situations", "together"] as const;
type Step = (typeof STEPS)[number];

/**
 * The Khutuwat tour: one idea per step, each beside the real thing in miniature, the activity and
 * the question working so the learner can try each once (nothing is saved). It sits at the bottom
 * of the screen without a backdrop, so the page stays usable; "Skip" (or Escape) closes it for
 * good on this device.
 */
export function GuidePanel({ sample, focus }: { sample: TourSample; focus: boolean }) {
  const t = useTranslations("Guide");
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [index, setIndex] = useState(0);
  const steps = STEPS.filter(
    (step) => (step !== "hands" || sample.activity) && (step !== "question" || sample.question) && (step !== "situations" || features.mawqif),
  );
  const step = steps[index] ?? "road";
  const last = index === steps.length - 1;

  useEffect(() => {
    // Asked for (a replay): take the focus. On a first visit, never steal it from the page.
    if (focus || index > 0) heading.current?.focus();
  }, [focus, index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeGuide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section
      aria-labelledby={titleId}
      aria-roledescription={t("label")}
      className="tone-day animate-rise-in fixed inset-x-3 bottom-3 z-50 max-h-[min(40rem,66dvh)] overflow-y-auto rounded-3xl border border-hairline bg-paper shadow-[0_18px_40px_-18px_color-mix(in_srgb,var(--night)_70%,transparent)] sm:inset-x-auto sm:end-6 sm:bottom-6 sm:w-[28rem]"
    >
      <div className="grid gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-muted-foreground">{t("stepOf", { current: index + 1, total: steps.length })}</p>
          <ol aria-hidden className="flex gap-1.5">
            {steps.map((name, position) => (
              <li key={name} className={cn("h-1.5 w-6 rounded-full", position <= index ? "bg-dawn" : "bg-hairline")} />
            ))}
          </ol>
        </div>
        <div className="grid gap-1.5" aria-live="polite">
          <h2 id={titleId} ref={heading} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
            {t(`steps.${step}.title`)}
          </h2>
          <p className="leading-relaxed text-muted-foreground">{t(`steps.${step}.body`)}</p>
        </div>
        <Suspense fallback={<Frame>{null}</Frame>}>
          <Preview key={step} step={step} sample={sample} />
        </Suspense>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={closeGuide}>
            {t("skip")}
          </Button>
          {last ? (
            <Button onClick={closeGuide}>{t("start")}</Button>
          ) : (
            <Button onClick={() => setIndex(index + 1)}>{t("next")}</Button>
          )}
        </div>
      </div>
    </section>
  );
}

function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid min-h-32 place-items-center rounded-2xl bg-sand p-4", className)}>{children}</div>;
}

/** A working preview, tried once: after its first finish it says so and stays as it is. */
function TryOnce({ children, done }: { children: ReactNode; done: boolean }) {
  const t = useTranslations("Guide");
  const ta = useTranslations("Activity");
  return (
    <div className="grid gap-3 rounded-2xl bg-sand p-4">
      <p className="text-sm font-semibold text-muted-foreground">{t("tryHere")}</p>
      {children}
      {done && <Feedback tone="right">{ta("wellDone")}</Feedback>}
    </div>
  );
}

function Preview({ step, sample }: { step: Step; sample: TourSample }) {
  const t = useTranslations("Guide");
  const { centers } = useReferralCentres();
  const [done, setDone] = useState(false);

  if (step === "road") {
    return (
      <Frame>
        <ol aria-label={t("previewStations")} className="relative flex w-full items-start justify-between px-2">
          <span aria-hidden className="absolute inset-x-8 top-7 border-t-2 border-dashed border-dawn" />
          {sample.stations.map((station, position) => (
            <li key={station.id} className="relative grid justify-items-center gap-2 text-center">
              <StationMarker state={position === 0 ? "current" : "open"}>
                <span className="font-display text-lg font-semibold">{position + 1}</span>
              </StationMarker>
              <span className="text-sm font-semibold">{station.title}</span>
            </li>
          ))}
        </ol>
      </Frame>
    );
  }
  if (step === "class" && sample.line) {
    return (
      <div className="relative">
        <ChalkBoard label={t("steps.class.title")}>
          <p className="chalk-text line-clamp-3 text-lg leading-relaxed">{sample.line.text}</p>
          <p className="text-xs text-muted-foreground">{t("previewSource", { title: sample.line.source })}</p>
        </ChalkBoard>
        <RafiqFigure pose="writing" height={88} decorative className="absolute -bottom-1 end-1 h-20 w-auto rtl:-scale-x-100" />
      </div>
    );
  }
  if (step === "hands" && sample.activity && sample.activity.activity.type === "order") {
    return (
      <TryOnce done={done}>
        <SequenceBuilder items={sample.activity.activity.items} seed={sample.activity.seed} onComplete={() => setDone(true)} />
      </TryOnce>
    );
  }
  if (step === "question" && sample.question) {
    return (
      <div className="grid gap-3">
        <TryOnce done={false}>
          <QuestionCard question={sample.question} mode="practice" onAnswered={() => setDone(true)} />
        </TryOnce>
        {done && (
          <Stamp ringText={`${t("steps.question.title")} ·`} icon={Check} tone="oasis" rotate={-8} appear className="size-24 justify-self-center" />
        )}
      </div>
    );
  }
  if (step === "situations") {
    return (
      <Frame className="grid-cols-[7rem_minmax(0,1fr)] items-center gap-4">
        <span className="overflow-hidden rounded-2xl bg-sand">
          <SituationArt art="greeting" />
        </span>
        <Button asChild size="sm" className="justify-self-start">
          <Link href="/mawqif" onClick={closeGuide}>
            {t("openMawqif")}
          </Link>
        </Button>
      </Frame>
    );
  }
  const national = nationalChannels(centers)[0];
  return (
    <Frame className="grid-cols-[auto_minmax(0,1fr)] gap-4">
      <RafiqFigure pose="encouraging" height={112} decorative className="h-28 w-auto rtl:-scale-x-100" />
      <div className="grid gap-2">
        {features.rafiq && (
          <Button asChild size="sm" className="justify-self-start">
            <Link href="/rafiq" onClick={closeGuide}>
              {t("askRafiq")}
            </Link>
          </Button>
        )}
        <span className="inline-flex items-center gap-2 justify-self-start rounded-full border border-hairline bg-paper px-3 py-1 text-sm font-semibold">
          <Phone aria-hidden className="size-4 text-oasis-text" />
          {t("previewNational")}
        </span>
        {national && (
          <span lang="ar" dir="rtl" className="text-sm text-muted-foreground">
            {national.name.ar}
          </span>
        )}
      </div>
    </Frame>
  );
}
