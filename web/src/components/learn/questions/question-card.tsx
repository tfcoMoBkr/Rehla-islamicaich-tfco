"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Feedback } from "@/components/learn/feedback";
import { MatchBoard } from "@/components/learn/interactions/match-board";
import { SequenceBuilder } from "@/components/learn/interactions/sequence-builder";
import { SortDeck } from "@/components/learn/interactions/sort-deck";
import { Button } from "@/components/ui/button";
import type { QuestionView } from "@/lib/learn/types";

import { ChoiceQuestion } from "./choice-question";

type QuestionCardProps = {
  question: QuestionView;
  mode: "practice" | "assess";
  /** Correct on the first try: no wrong choice or wrong tap along the way. */
  onAnswered: (correctFirstTime: boolean) => void;
};

/** Any question type, in practice (immediate, forgiving feedback) or assessment mode. */
export function QuestionCard({ question, mode, onAnswered }: QuestionCardProps) {
  const t = useTranslations("Question");
  const [mistakes, setMistakes] = useState<number | null>(null);

  if (question.type === "single" || question.type === "multiple" || question.type === "trueFalse") {
    return <ChoiceQuestion question={question} mode={mode} onAnswered={onAnswered} />;
  }

  const hints = mode === "practice";
  const finish = (count: number) => setMistakes(count);

  return (
    <div className="grid gap-5">
      <p className="text-xl leading-relaxed font-semibold">{question.prompt}</p>
      {question.type === "order" && (
        <SequenceBuilder items={question.items} seed={question.id} hints={hints} onComplete={finish} />
      )}
      {question.type === "match" && (
        <MatchBoard pairs={question.pairs} seed={question.id} hints={hints} onComplete={finish} />
      )}
      {question.type === "sort" && (
        <SortDeck groups={question.groups} items={question.items} seed={question.id} hints={hints} onComplete={finish} />
      )}
      {mistakes !== null && (
        <>
          {mode === "practice" && (
            <Feedback tone="right" quote={question.sourceQuote}>
              {t("right")}
            </Feedback>
          )}
          <Button className="justify-self-start" onClick={() => onAnswered(mistakes === 0)}>
            {mode === "practice" ? t("continue") : t("next")}
          </Button>
        </>
      )}
    </div>
  );
}
