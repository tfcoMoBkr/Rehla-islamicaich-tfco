"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

import { useProgress } from "@/lib/learn/progress-store";

/**
 * A practice card's own line: the learner's best round, and, for an activity from a lesson they
 * have not taken yet, a gentle pointer to that lesson. Nothing is locked.
 */
export function PracticeCardStatus({ entryKey, lessonId }: { entryKey: string; lessonId: string }) {
  const t = useTranslations("Practice");
  const progress = useProgress();
  const best = progress.practice.best[entryKey];
  const taken = Boolean(progress.completedLessons[lessonId]);
  const score = !best ? null : best.total === 0 ? t("bestDone") : t("score", { correct: best.correct, total: best.total });

  return (
    <div className="grid gap-2 text-sm">
      <p className="flex items-center gap-1.5 font-medium">
        {best && <Check aria-hidden className="size-4 text-oasis-text" />}
        {score ? t("best", { score }) : t("bestNone")}
      </p>
      {!taken && <p className="text-muted-foreground">{t("notYet")}</p>}
    </div>
  );
}
