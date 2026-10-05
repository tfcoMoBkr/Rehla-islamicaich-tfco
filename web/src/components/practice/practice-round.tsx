"use client";

import { Backpack } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Stamp } from "@/components/journey/stamp";
import { ActivityRunner } from "@/components/learn/activities/activity-runner";
import { QuestionCard } from "@/components/learn/questions/question-card";
import { Button } from "@/components/ui/button";
import { PRACTICE_POINTS } from "@/config/learning";
import { Link } from "@/i18n/navigation";
import { progressActions } from "@/lib/learn/progress-store";
import type { ActivityView, QuestionView } from "@/lib/learn/types";

type Phase = { kind: "activity" } | { kind: "questions"; index: number } | { kind: "done" };

type PracticeRoundProps = {
  entryKey: string;
  lessonId: string;
  activity: ActivityView;
  questions: QuestionView[];
};

/**
 * One practice round: the lesson's activity, full width and exactly as in the lesson, then the
 * lesson's own short questions. A completed activity and each right answer add provisions the
 * first time; a wrong try costs nothing, and "Try again" starts the round afresh.
 */
export function PracticeRound(props: PracticeRoundProps) {
  const [attempt, setAttempt] = useState(0);
  return <Round key={attempt} {...props} onAgain={() => setAttempt(attempt + 1)} />;
}

function Round({ entryKey, lessonId, activity, questions, onAgain }: PracticeRoundProps & { onAgain: () => void }) {
  const t = useTranslations("Practice");
  const [phase, setPhase] = useState<Phase>({ kind: "activity" });
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [earned, setEarned] = useState(0);

  function earn(id: string, points: number) {
    if (progressActions.earn(id, points)) setEarned((count) => count + 1);
  }

  function finishActivity() {
    earn(`activity:${entryKey}`, PRACTICE_POINTS.activity);
    if (questions.length > 0) setPhase({ kind: "questions", index: 0 });
    else {
      progressActions.bestRound(entryKey, 0, 0);
      setPhase({ kind: "done" });
    }
  }

  function answered(question: QuestionView, index: number, correct: boolean) {
    const next = { ...answers, [question.id]: correct };
    setAnswers(next);
    if (correct) earn(`question:${question.id}`, PRACTICE_POINTS.question);
    if (index + 1 < questions.length) {
      setPhase({ kind: "questions", index: index + 1 });
      return;
    }
    progressActions.bestRound(entryKey, Object.values(next).filter(Boolean).length, questions.length);
    setPhase({ kind: "done" });
  }

  const correct = Object.values(answers).filter(Boolean).length;
  const question = phase.kind === "questions" ? questions[phase.index] : undefined;

  return (
    <div className="grid gap-8">
      {phase.kind === "activity" && <ActivityRunner activity={activity} lessonId={lessonId} onDone={finishActivity} />}

      {phase.kind === "questions" && question && (
        <section aria-labelledby="practice-questions" className="grid gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="practice-questions" className="font-display text-2xl font-semibold">
              {t("questionsTitle")}
            </h2>
            <p className="text-sm font-medium text-muted-foreground">
              {phase.index + 1} / {questions.length}
            </p>
          </div>
          <QuestionCard key={question.id} question={question} mode="practice" onAnswered={(right) => answered(question, phase.index, right)} />
        </section>
      )}

      {phase.kind === "done" && (
        <section aria-labelledby="practice-done" className="grid gap-4 rounded-3xl border border-hairline bg-paper p-6">
          <h2 id="practice-done" className="font-display text-2xl font-semibold">
            {t("roundDone")}
          </h2>
          {questions.length > 0 ? <p className="text-lg">{t("roundScore", { correct, total: questions.length })}</p> : <p>{t("noQuestions")}</p>}
          <div className="flex flex-wrap gap-3">
            <Button onClick={onAgain}>{t("tryAgain")}</Button>
            <Button asChild variant="outline">
              <Link href="/practice">{t("backToPractice")}</Link>
            </Button>
          </div>
        </section>
      )}

      {earned > 0 && <Celebration key={earned} />}
    </div>
  );
}

/** A small moment when new provisions go in the bag: a stamp pressed in (still under reduced motion). */
function Celebration() {
  const t = useTranslations("Practice");
  return (
    <p role="status" className="flex items-center gap-4 rounded-2xl border border-dawn/60 bg-dawn/12 px-5 py-4 font-semibold">
      <Stamp ringText={`${t("title")} ·`} icon={Backpack} tone="terracotta" rotate={-8} appear className="size-16 shrink-0" />
      {t("earned")}
    </p>
  );
}
