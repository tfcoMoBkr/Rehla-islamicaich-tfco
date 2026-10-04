"use client";

import { ArrowRight, Compass } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AssessmentRunner } from "@/components/learn/assessment/assessment-runner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { progressActions } from "@/lib/learn/progress-store";
import type { QuestionView } from "@/lib/learn/types";

type BaselineFlowProps = {
  stationId: string;
  stationTitle: string;
  questions: readonly QuestionView[];
  nextHref: string;
};

/**
 * «ماذا أعرف؟» / "What do I already know?": scored so the journal can show the gain later,
 * but never presented as a pass or a fail.
 */
export function BaselineFlow({ stationId, stationTitle, questions, nextHref }: BaselineFlowProps) {
  const t = useTranslations("Baseline");
  const [phase, setPhase] = useState<"intro" | "run" | "done">("intro");
  const [answered, setAnswered] = useState({ correct: 0, total: 0 });

  if (questions.length === 0) {
    return (
      <Card className="px-6 sm:px-8">
        <p>{t("empty")}</p>
        <Button asChild variant="outline" className="justify-self-start">
          <Link href={nextHref}>{t("skip")}</Link>
        </Button>
      </Card>
    );
  }

  if (phase === "run") {
    return (
      <AssessmentRunner
        questions={questions}
        onFinish={(answers) => {
          progressActions.saveBaseline(stationId, answers);
          const values = Object.values(answers);
          setAnswered({ correct: values.filter(Boolean).length, total: values.length });
          setPhase("done");
        }}
      />
    );
  }

  return (
    <Card className="gap-4 px-6 sm:px-8">
      <Compass aria-hidden className="size-7 text-oasis-text" />
      {phase === "intro" ? (
        <>
          <p className="text-lg">{t("intro", { station: stationTitle })}</p>
          <p className="text-muted-foreground">{t("noPassOrFail", { count: questions.length })}</p>
          <Button size="lg" className="justify-self-start" onClick={() => setPhase("run")}>
            {t("start")}
          </Button>
        </>
      ) : (
        <>
          <p className="text-lg" role="status">
            {t("saved", answered)}
          </p>
          <p className="text-muted-foreground">{t("compareLater")}</p>
          <Button asChild size="lg" className="justify-self-start">
            <Link href={nextHref}>
              {t("continue")}
              <ArrowRight aria-hidden className="rtl:-scale-x-100" />
            </Link>
          </Button>
        </>
      )}
    </Card>
  );
}
