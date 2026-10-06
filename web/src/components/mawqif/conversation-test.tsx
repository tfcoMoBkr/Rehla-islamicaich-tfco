"use client";

import { ArrowRight, BookOpen, CircleCheck, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { progressActions, useProgress } from "@/lib/learn/progress-store";
import { conversationKey, testRoundKey } from "@/lib/mawqif/progress";
import { analyseConversations, keyPointsOf, testSituations } from "@/lib/mawqif/conversation";
import type { SituationView } from "@/lib/mawqif/types";

import { PracticeConversation, type ConversationResult } from "./practice-conversation";
import { PracticeFeedback } from "./practice-feedback";

/** Each conversation of the test is short: two or three replies. */
const TEST_REPLIES = { min: 1, max: 3 } as const;

/**
 * The final test as conversations: several situations in a row, each a short conversation with a
 * fresh scene, then the score from the key points met, each reply's feedback with a better reply
 * where it helps, and an analysis: what the learner handles well, which situations to practise
 * again, and which lessons to revisit.
 */
export function ConversationTest({ group, views, onUnavailable }: { group: string; views: readonly SituationView[]; onUnavailable: () => void }) {
  const t = useTranslations("Mawqif");
  const progress = useProgress();
  const [chosen] = useState(() => testSituations(views, (id) => Object.keys(progress.practice.best).includes(conversationKey(id)) || Object.keys(progress.practice.earned).some((key) => key.startsWith(`mawqif:${id}:`))));
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<ConversationResult[]>([]);
  const [attempt, setAttempt] = useState(0);

  if (results.length < chosen.length) {
    const situation = chosen[index]!;
    return (
      <section className="grid gap-4">
        <p className="text-sm text-muted-foreground">{t("conversationTestIntro", { count: chosen.length })}</p>
        <h2 className="font-display text-2xl font-semibold">{t("testSituationOf", { number: index + 1, total: chosen.length, title: situation.title })}</h2>
        <PracticeConversation
          key={`${attempt}-${situation.id}`}
          situation={situation}
          minReplies={TEST_REPLIES.min}
          maxReplies={TEST_REPLIES.max}
          avoid={[]}
          onFinished={(result) => {
            const next = [...results, result];
            setResults(next);
            if (next.length < chosen.length) setIndex(index + 1);
            else {
              const scores = chosen.map((view, i) => ({ situation: view.id, met: next[i]!.met.length, total: keyPointsOf(view).length }));
              const { met, total } = analyseConversations(scores);
              progressActions.bestRound(`${testRoundKey(group)}:conversation`, met, total);
            }
          }}
          onUnavailable={onUnavailable}
        />
      </section>
    );
  }

  const scores = chosen.map((view, i) => ({ situation: view.id, met: results[i]!.met.length, total: keyPointsOf(view).length }));
  const analysis = analyseConversations(scores);
  const titleOf = (id: string) => chosen.find((view) => view.id === id)?.title ?? id;
  const lessons = [...new Map(chosen.filter((view) => analysis.practise.includes(view.id)).flatMap((view) => view.related).map((lesson) => [lesson.id, lesson])).values()];

  return (
    <div className="grid gap-8">
      <section className="grid gap-2">
        <h2 className="font-display text-3xl font-semibold">{t("testKeyScore", { met: analysis.met, total: analysis.total })}</h2>
      </section>

      <section aria-labelledby="test-analysis" className="grid gap-4">
        <h2 id="test-analysis" className="font-display text-2xl font-semibold">
          {t("analysisTitle")}
        </h2>
        {analysis.strong.length > 0 && (
          <div className="grid gap-2">
            <h3 className="flex items-center gap-2 font-semibold text-oasis-text">
              <CircleCheck aria-hidden className="size-4" />
              {t("handlesWell")}
            </h3>
            <ul className="flex flex-wrap gap-2">
              {analysis.strong.map((id) => (
                <li key={id} className="rounded-full bg-oasis/12 px-3 py-1">
                  {titleOf(id)}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid gap-2">
          <h3 className="font-semibold">{t("practiseAgainTitle")}</h3>
          {analysis.practise.length === 0 ? (
            <p>{t("nothingToPractise")}</p>
          ) : (
            <ul className="grid gap-1">
              {analysis.practise.map((id) => (
                <li key={id}>
                  <Link href={`/mawqif/${id}`} className="inline-flex min-h-11 items-center gap-2 font-medium underline underline-offset-4">
                    <ArrowRight aria-hidden className="size-4 rtl:-scale-x-100" />
                    {titleOf(id)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        {lessons.length > 0 && (
          <div className="grid gap-2">
            <h3 className="font-semibold">{t("lessonsToRevisit")}</h3>
            <ul className="grid gap-1">
              {lessons.map((lesson) => (
                <li key={lesson.id}>
                  <Link href={lesson.href} className="inline-flex min-h-11 items-center gap-2 font-medium underline underline-offset-4">
                    <BookOpen aria-hidden className="size-4" />
                    {t("lessonLink", { number: lesson.id, title: lesson.title })}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {chosen.map((view, i) => (
        <section key={view.id} className="grid gap-3">
          <h2 className="font-display text-xl font-semibold">{view.title}</h2>
          <PracticeFeedback situation={view} result={results[i]!} />
        </section>
      ))}

      <Button
        variant="outline"
        className="justify-self-start"
        onClick={() => {
          setResults([]);
          setIndex(0);
          setAttempt((count) => count + 1);
        }}
      >
        <RotateCcw aria-hidden />
        {t("testAgain")}
      </Button>
    </div>
  );
}
