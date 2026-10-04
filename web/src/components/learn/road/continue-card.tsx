"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Lantern } from "@/components/journey/lantern";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { stepHref, type NextStep } from "@/lib/learn/road";
import type { StationView } from "@/lib/learn/types";

/** The one clear next step on the road. */
export function ContinueCard({ step, road }: { step: NextStep; road: readonly StationView[] }) {
  const t = useTranslations("Learn");
  const station = step.kind === "rest" ? undefined : road.find((candidate) => candidate.id === step.stationId);
  const lesson =
    step.kind === "lesson" ? station?.lessons.find((candidate) => candidate.id === step.lessonId) : undefined;

  const detail =
    step.kind === "baseline"
      ? t("continue.baseline", { station: station?.title ?? "" })
      : step.kind === "lesson"
        ? t("continue.lesson", { number: lesson?.id ?? "", title: lesson?.title ?? "" })
        : step.kind === "exam"
          ? t("continue.exam", { station: station?.title ?? "" })
          : t("continue.rest");

  return (
    <div className="tone-night flex flex-col gap-5 rounded-2xl bg-background p-6 sm:flex-row sm:items-center sm:p-8">
      <Lantern className="size-14 shrink-0 text-sand" />
      <div className="grid flex-1 gap-1">
        <p className="font-display text-2xl font-semibold">{t("continue.title")}</p>
        <p className="text-muted-foreground">{detail}</p>
      </div>
      <Button asChild size="lg">
        <Link href={stepHref(step)}>
          {step.kind === "rest" ? t("continue.journal") : t("continue.go")}
          <ArrowRight aria-hidden className="rtl:-scale-x-100" />
        </Link>
      </Button>
    </div>
  );
}
