"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { QuestionCard } from "@/components/learn/questions/question-card";
import { progressActions } from "@/lib/learn/progress-store";
import type { QuestionView } from "@/lib/learn/types";

import { StepDots } from "./step-dots";

type AssessmentRunnerProps = {
  questions: readonly QuestionView[];
  onFinish: (answers: Record<string, boolean>) => void;
};

/** Scored questions, one per screen, without feedback until the end. */
export function AssessmentRunner({ questions, onFinish }: AssessmentRunnerProps) {
  const t = useTranslations("Assessment");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const question = questions[index];

  if (!question) return null;

  function answered(correct: boolean) {
    if (!question) return;
    progressActions.answer(question.id, correct);
    const next = { ...answers, [question.id]: correct };
    setAnswers(next);
    if (index + 1 === questions.length) onFinish(next);
    else setIndex(index + 1);
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          {t("questionOf", { current: index + 1, total: questions.length })}
        </p>
        <StepDots total={questions.length} current={index} />
      </div>
      <QuestionCard key={question.id} question={question} mode="assess" onAnswered={answered} />
    </div>
  );
}
