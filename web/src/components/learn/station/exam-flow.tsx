"use client";

import { ArrowRight, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AssessmentRunner } from "@/components/learn/assessment/assessment-runner";
import { ReviewList } from "@/components/learn/assessment/review-list";
import { ScoreSummary } from "@/components/learn/assessment/score-summary";
import { QuestionCard } from "@/components/learn/questions/question-card";
import { Stamp } from "@/components/journey/stamp";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EXAM_PASS_RATIO } from "@/config/learning";
import { Link } from "@/i18n/navigation";
import { gain, type ExamRecord } from "@/lib/learn/progress";
import { progressActions, useProgress } from "@/lib/learn/progress-store";
import { missedQuestions } from "@/lib/learn/provisions";
import type { QuestionView } from "@/lib/learn/types";

type ExamFlowProps = {
  stationId: string;
  stationTitle: string;
  questions: readonly QuestionView[];
  /** All of the station's earlier questions; the missed ones are reviewed before the exam. */
  reviewPool: readonly QuestionView[];
  nextHref: string;
};

type Phase = "intro" | "review" | "run" | "result";

export function ExamFlow({ stationId, stationTitle, questions, reviewPool, nextHref }: ExamFlowProps) {
  const t = useTranslations("Exam");
  const progress = useProgress();
  const [phase, setPhase] = useState<Phase>("intro");
  const [review, setReview] = useState<QuestionView[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [result, setResult] = useState<{ record: ExamRecord; answers: Record<string, boolean> } | null>(null);

  if (questions.length === 0) {
    return (
      <Card className="px-6 sm:px-8">
        <p>{t("empty")}</p>
        <Button asChild variant="outline" className="justify-self-start">
          <Link href="/learn">{t("backToRoad")}</Link>
        </Button>
      </Card>
    );
  }

  function start() {
    const missed = missedQuestions(reviewPool, progress);
    setReview(missed);
    setReviewIndex(0);
    setPhase(missed.length > 0 ? "review" : "run");
  }

  if (phase === "review") {
    const question = review[reviewIndex];
    return (
      <div className="grid gap-6">
        <p className="text-muted-foreground">
          {t("reviewIntro")} · {t("itemOf", { current: reviewIndex + 1, total: review.length })}
        </p>
        {question && (
          <QuestionCard
            key={question.id}
            question={question}
            mode="practice"
            onAnswered={(correct) => {
              progressActions.answer(question.id, correct);
              if (reviewIndex + 1 < review.length) setReviewIndex(reviewIndex + 1);
              else setPhase("run");
            }}
          />
        )}
      </div>
    );
  }

  if (phase === "run") {
    return (
      <AssessmentRunner
        questions={questions}
        onFinish={(answers) => {
          const record = progressActions.saveExam(stationId, answers, EXAM_PASS_RATIO);
          setResult({ record, answers });
          setPhase("result");
        }}
      />
    );
  }

  if (phase === "result" && result) {
    const stationGain = gain(progress.baselines[stationId], result.record);
    return (
      <div className="grid gap-6">
        <div className="relative">
          <ScoreSummary
            correct={result.record.correct}
            total={result.record.total}
            note={result.record.passed ? t("passed") : t("notYet", { percent: Math.round(EXAM_PASS_RATIO * 100) })}
            className="pe-32"
          />
          {result.record.passed && (
            <Stamp
              appear
              ringText={`${stationTitle} · ${t("stampRing")} ·`}
              icon={Check}
              tone="oasis"
              label={t("stampLabel", { station: stationTitle })}
              className="absolute end-3 -top-5 size-28"
            />
          )}
        </div>
        {stationGain !== null && (
          <p className="rounded-xl bg-oasis/10 p-4 font-medium text-oasis-text">{t("gain", { gain: stationGain })}</p>
        )}
        <h2 className="font-display text-xl font-semibold">{t("reviewTitle")}</h2>
        <ReviewList questions={questions} answers={result.answers} />
        <div className="flex flex-wrap gap-3">
          {result.record.passed ? (
            <Button asChild size="lg">
              <Link href={nextHref}>
                {t("continue")}
                <ArrowRight aria-hidden className="rtl:-scale-x-100" />
              </Link>
            </Button>
          ) : (
            <Button size="lg" onClick={start}>
              {t("tryAgain")}
            </Button>
          )}
          <Button asChild variant="outline" size="lg">
            <Link href="/learn/journal">{t("openJournal")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const missedCount = missedQuestions(reviewPool, progress).length;
  return (
    <Card className="gap-4 px-6 sm:px-8">
      <p className="text-lg">{t("intro", { station: stationTitle, count: questions.length })}</p>
      <p className="text-muted-foreground">
        {missedCount > 0 ? t("reviewFirst", { count: missedCount }) : t("noReview")}
      </p>
      <Button size="lg" className="justify-self-start" onClick={start}>
        {t("start")}
      </Button>
    </Card>
  );
}
