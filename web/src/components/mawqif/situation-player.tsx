"use client";

import { ArrowRight, BookOpen, MessagesSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Stamp } from "@/components/journey/stamp";
import { RafiqFigure } from "@/components/rafiq/rafiq-figure";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { progressActions } from "@/lib/learn/progress-store";
import { keyPointsOf } from "@/lib/mawqif/conversation";
import { MAX_REPLIES, MIN_REPLIES, sceneSummary } from "@/lib/mawqif/practice";
import { checkQuestionKey, checkRoundKey, conversationKey, pointKey, POINT_PROVISIONS, QUESTION_PROVISIONS } from "@/lib/mawqif/progress";
import type { TurnOutcome } from "@/lib/mawqif/turn";
import type { QuoteView, SituationView } from "@/lib/mawqif/types";
import { cn } from "@/lib/utils";

import { ExplainQuote } from "./explain-quote";
import { PracticeConversation, type ConversationResult } from "./practice-conversation";
import { PracticeFeedback } from "./practice-feedback";
import { RoleplayTurn } from "./roleplay-turn";
import { SituationArt } from "./situation-art";
import { SituationCheck } from "./situation-check";

type Stage = "learn" | "practise" | "written" | "feedback" | "check" | "done";
const STEPS = ["learn", "practise", "feedback", "check"] as const;
const stepOf = (stage: Stage): (typeof STEPS)[number] => (stage === "written" ? "practise" : stage === "done" ? "check" : stage);

/**
 * One situation: learn the words to say (with Rafiq's plain explanation, and Rafiq in place when
 * something is unclear), practise them in a real conversation, then feedback on each reply. The
 * quick written check stays as an option. When the conversation is unavailable, the written
 * replies of the situation are the practice.
 */
export function SituationPlayer({ situation, next }: { situation: SituationView; next: { href: `/${string}`; title: string } | null }) {
  const t = useTranslations("Mawqif");
  const [stage, setStage] = useState<Stage>("learn");
  const [attempt, setAttempt] = useState(0);
  const [scenes, setScenes] = useState<string[]>([]);
  const [result, setResult] = useState<ConversationResult | null>(null);
  const [turn, setTurn] = useState(0);
  const [outcomes, setOutcomes] = useState<TurnOutcome[]>([]);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const opened = useRef(false);
  const points = keyPointsOf(situation);

  useEffect(() => {
    // Focus follows each new screen, so a screen reader hears it; not on first load.
    if (opened.current) heading.current?.focus();
    opened.current = true;
  }, [stage, turn]);

  const go = (next: Stage) => {
    setStage(next);
    window.scrollTo({ top: 0 });
  };
  const itemOf = (quote: QuoteView) => situation.items.find((item) => item.id === quote.ref);

  function finished(done: ConversationResult) {
    progressActions.bestRound(conversationKey(situation.id), done.met.length, points.length);
    for (const point of done.met) progressActions.earn(pointKey(situation.id, point), POINT_PROVISIONS);
    setScenes((list) => [...list, sceneSummary(done.scene)]);
    setResult(done);
    go("feedback");
  }

  function practiseAgain() {
    setResult(null);
    setOutcomes([]);
    setTurn(0);
    setScore(null);
    setAttempt((count) => count + 1);
    go("practise");
  }

  const step = stepOf(stage);
  const quotes = (slot: "say" | "why" | "when") =>
    situation.learn[slot].map((quote, index) => (
      <ExplainQuote key={`${slot}-${quote.ref}-${index}`} situationId={situation.id} quote={quote} item={itemOf(quote)} explainNow={slot === "say"} />
    ));

  return (
    <div className="grid gap-8">
      <ol aria-label={t("progressLabel")} className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {STEPS.map((name, index) => {
          const current = name === step;
          const done = STEPS.indexOf(step) > index;
          return (
            <li key={name} aria-current={current ? "step" : undefined} className={cn("flex items-center gap-2", current ? "font-semibold" : "text-muted-foreground")}>
              <span className={cn("grid size-6 place-items-center rounded-full border-2 text-xs", done ? "border-oasis bg-oasis text-paper" : current ? "border-dawn" : "border-hairline")}>
                {index + 1}
              </span>
              {t(`steps.${name}`)}
            </li>
          );
        })}
      </ol>

      {stage === "learn" && (
        <section className="grid gap-5">
          <div className="overflow-hidden rounded-3xl border border-hairline bg-sand">
            <SituationArt art={situation.art} className="mx-auto max-h-48" />
          </div>
          <div className="flex items-center gap-3">
            <RafiqFigure pose="pointing" height={72} decorative className="h-16 w-auto shrink-0" />
            <h2 ref={heading} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
              {t("learnTitle")}
            </h2>
          </div>
          <p className="leading-relaxed text-muted-foreground">
            {situation.scene} · {t("teamWording")}
          </p>
          {situation.reviewed !== true && <p className="text-sm text-muted-foreground">{t("notReviewed")}</p>}
          <h3 className="font-display text-xl font-semibold">{t("learn.say")}</h3>
          {quotes("say")}
          {situation.learn.why.length > 0 && (
            <>
              <h3 className="font-display text-xl font-semibold">{t("learn.why")}</h3>
              {quotes("why")}
            </>
          )}
          {situation.learn.when.length > 0 && (
            <>
              <h3 className="font-display text-xl font-semibold">{t("learn.when")}</h3>
              {quotes("when")}
            </>
          )}
          <Button className="justify-self-start" onClick={() => go("practise")}>
            <MessagesSquare aria-hidden />
            {t("startPractice")}
          </Button>
        </section>
      )}

      {stage === "practise" && (
        <section className="grid gap-4">
          <h2 ref={heading} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
            {t("practiseTitle")}
          </h2>
          <p className="text-muted-foreground">{t("practiseIntro")}</p>
          <PracticeConversation
            key={attempt}
            situation={situation}
            minReplies={MIN_REPLIES}
            maxReplies={MAX_REPLIES}
            avoid={scenes}
            onFinished={finished}
            onUnavailable={() => go("written")}
          />
        </section>
      )}

      {stage === "written" && (
        <section className="grid gap-4">
          <h2 ref={heading} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
            {t("practiseTitle")}
          </h2>
          <RoleplayTurn
            key={situation.exchanges[turn]!.id}
            situationId={situation.id}
            exchange={situation.exchanges[turn]!}
            index={turn}
            character={situation.character}
            items={situation.items}
            onDone={(outcome) => {
              const done = [...outcomes.slice(0, turn), outcome];
              setOutcomes(done);
              if (turn + 1 < situation.exchanges.length) {
                setTurn(turn + 1);
                window.scrollTo({ top: 0 });
                return;
              }
              const met = [...new Set(done.flatMap((item) => item.met))];
              progressActions.bestRound(conversationKey(situation.id), met.length, points.length);
              setResult({
                scene: { person: situation.character, place: "", mood: "", setting: situation.scene, line: "" },
                history: [],
                met,
              });
              go("feedback");
            }}
          />
        </section>
      )}

      {stage === "feedback" && result && (
        <section className="grid gap-5">
          <h2 ref={heading} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
            {t("feedbackTitle")}
          </h2>
          <PracticeFeedback situation={situation} result={result} />
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => go("check")}>
              {t("quickCheck")}
              <ArrowRight aria-hidden className="rtl:-scale-x-100" />
            </Button>
            <Button variant="outline" onClick={practiseAgain}>
              {t("practiseNew")}
            </Button>
            <Button variant="ghost" onClick={() => go("done")}>
              {t("skipCheck")}
            </Button>
          </div>
        </section>
      )}

      {stage === "check" && (
        <section className="grid gap-4">
          <h2 ref={heading} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
            {t("checkTitle")}
          </h2>
          <SituationCheck
            checks={situation.check}
            items={situation.items}
            onAnswer={(check, correct) => {
              if (correct) progressActions.earn(checkQuestionKey(situation.id, check), QUESTION_PROVISIONS);
            }}
            onDone={(correct, total) => {
              progressActions.bestRound(checkRoundKey(situation.id), correct, total);
              setScore({ correct, total });
              go("done");
            }}
          />
        </section>
      )}

      {stage === "done" && (
        <section className="grid gap-5">
          <div className="flex flex-wrap items-center gap-5">
            {result && result.met.length === points.length && (
              <Stamp appear ringText={`${situation.title} ·`} center="✓" tone="oasis" rotate={-8} label={t("stampLabel", { title: situation.title })} className="size-28" />
            )}
            <div className="grid gap-1">
              <h2 ref={heading} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
                {result ? t("feedbackScore", { met: result.met.length, total: points.length }) : t("feedbackTitle")}
              </h2>
              {score && <p>{t("checkScore", { correct: score.correct, total: score.total })}</p>}
            </div>
          </div>
          {situation.related.length > 0 && (
            <div className="grid gap-2">
              <h3 className="font-semibold">{t("relatedLessons")}</h3>
              <ul className="grid gap-1">
                {situation.related.map((lesson) => (
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
          <div className="flex flex-wrap gap-3">
            {next && (
              <Button asChild>
                <Link href={next.href}>
                  {t("nextSituation", { title: next.title })}
                  <ArrowRight aria-hidden className="rtl:-scale-x-100" />
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/mawqif">{t("backToMap")}</Link>
            </Button>
            <Button variant="ghost" onClick={practiseAgain}>
              {t("practiseNew")}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
