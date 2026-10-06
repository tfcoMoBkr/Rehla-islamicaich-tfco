"use client";

import { BookOpen, CircleCheck, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Stamp } from "@/components/journey/stamp";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { progressActions } from "@/lib/learn/progress-store";
import { analyseTest, QUESTION_PROVISIONS, testQuestionKey, testRoundKey, type TestAnswer } from "@/lib/mawqif/progress";
import type { ItemView, RelatedLesson, SituationCheckView } from "@/lib/mawqif/types";

import { Parts, QuoteCard } from "./quote";
import { SituationCheck } from "./situation-check";

export type TestQuestion = { situation: string; check: SituationCheckView };
export type TestSituation = { id: string; title: string; href: `/${string}`; related: RelatedLesson[] };

/**
 * A final test: questions mixed from several situations, then the score, every question with its
 * right answer and source, and what to do next: what the learner handles well, which situations to
 * practise again, and which lessons to revisit.
 */
export function MawqifTest({
  group,
  questions,
  situations,
  items,
}: {
  group: string;
  questions: readonly TestQuestion[];
  situations: readonly TestSituation[];
  items: readonly ItemView[];
}) {
  const [attempt, setAttempt] = useState(0);
  const [answers, setAnswers] = useState<TestAnswer[]>([]);
  const [done, setDone] = useState(false);
  const titleOf = (id: string) => situations.find((situation) => situation.id === id)?.title ?? id;

  if (!done) {
    return (
      <SituationCheck
        key={attempt}
        checks={questions.map((question) => question.check)}
        items={items}
        label={(index) => titleOf(questions[index]!.situation)}
        onAnswer={(_check, correct, index) => {
          const question = questions[index]!;
          if (correct) progressActions.earn(testQuestionKey(group, question.situation, question.check.id), QUESTION_PROVISIONS);
          setAnswers((current) => [...current, { situation: question.situation, check: question.check.id, correct }]);
        }}
        onDone={(correct, total) => {
          progressActions.bestRound(testRoundKey(group), correct, total);
          setDone(true);
        }}
      />
    );
  }

  return (
    <TestResult
      questions={questions}
      situations={situations}
      answers={answers}
      onAgain={() => {
        setAnswers([]);
        setDone(false);
        setAttempt(attempt + 1);
        window.scrollTo({ top: 0 });
      }}
    />
  );
}

/** The score, what to do next, and every question with its right answer and source. */
export function TestResult({
  questions,
  situations,
  answers,
  onAgain,
}: {
  questions: readonly TestQuestion[];
  situations: readonly TestSituation[];
  answers: readonly TestAnswer[];
  onAgain: () => void;
}) {
  const t = useTranslations("Mawqif");
  const titleOf = (id: string) => situations.find((situation) => situation.id === id)?.title ?? id;
  const analysis = analyseTest(answers);
  const practise = situations.filter((situation) => analysis.practise.includes(situation.id));
  const strong = situations.filter((situation) => analysis.strong.includes(situation.id));
  const lessons = [...new Map(practise.flatMap((situation) => situation.related).map((lesson) => [lesson.id, lesson])).values()];

  return (
    <div className="grid gap-8">
      <section aria-labelledby="test-score" className="flex flex-wrap items-center gap-5 rounded-3xl border border-hairline bg-paper p-6">
        {analysis.score.correct === analysis.score.total && (
          <Stamp appear ringText={`${t("title")} ·`} center="✓" tone="oasis" rotate={-6} label={t("testStamp")} className="size-28" />
        )}
        <div className="grid gap-1">
          <h2 id="test-score" className="font-display text-3xl font-semibold">
            {t("checkScore", { correct: analysis.score.correct, total: analysis.score.total })}
          </h2>
          <p className="text-muted-foreground">{t("testScoreNote")}</p>
        </div>
      </section>

      <section aria-labelledby="test-analysis" className="grid gap-4">
        <h2 id="test-analysis" className="font-display text-2xl font-semibold">
          {t("analysisTitle")}
        </h2>
        {strong.length > 0 && (
          <div className="grid gap-2">
            <h3 className="flex items-center gap-2 font-semibold text-oasis-text">
              <CircleCheck aria-hidden className="size-4" />
              {t("handlesWell")}
            </h3>
            <ul className="flex flex-wrap gap-2">
              {strong.map((situation) => (
                <li key={situation.id} className="rounded-full bg-oasis/12 px-3 py-1">
                  {situation.title}
                </li>
              ))}
            </ul>
          </div>
        )}
        {practise.length > 0 ? (
          <div className="grid gap-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <RotateCcw aria-hidden className="size-4" />
              {t("practiseAgainTitle")}
            </h3>
            <ul className="grid gap-1">
              {practise.map((situation) => (
                <li key={situation.id}>
                  <Link href={situation.href} className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">
                    {situation.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p>{t("nothingToPractise")}</p>
        )}
        {lessons.length > 0 && (
          <div className="grid gap-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <BookOpen aria-hidden className="size-4" />
              {t("lessonsToRevisit")}
            </h3>
            <ul className="grid gap-1">
              {lessons.map((lesson) => (
                <li key={lesson.id}>
                  <Link href={lesson.href} className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">
                    {t("lessonLink", { number: lesson.id, title: lesson.title })}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-labelledby="test-review" className="grid gap-4">
        <h2 id="test-review" className="font-display text-2xl font-semibold">
          {t("reviewTitle")}
        </h2>
        <ol className="grid gap-4">
          {questions.map((question, index) => {
            const answer = answers[index];
            const right = question.check.options.find((option) => option.correct)!;
            return (
              <li key={`${question.situation}-${question.check.id}`} className="grid gap-2 rounded-2xl border border-hairline bg-paper p-4">
                <p className="text-sm text-muted-foreground">
                  {titleOf(question.situation)} · {answer?.correct ? t("reviewRight") : t("reviewWrong")}
                </p>
                <p className="font-semibold">{question.check.prompt}</p>
                {right.part.kind === "quote" ? <QuoteCard quote={right.part.quote} /> : <Parts parts={[right.part]} />}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button onClick={onAgain}>{t("testAgain")}</Button>
        <Button asChild variant="outline">
          <Link href="/mawqif">{t("backToMap")}</Link>
        </Button>
      </div>
    </div>
  );
}
