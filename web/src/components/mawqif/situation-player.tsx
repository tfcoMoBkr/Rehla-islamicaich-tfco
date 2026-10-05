"use client";

import { ArrowRight, BookOpen, MessageCircleQuestion } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Stamp } from "@/components/journey/stamp";
import { RafiqFigure } from "@/components/rafiq/rafiq-figure";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { progressActions } from "@/lib/learn/progress-store";
import { checkQuestionKey, checkRoundKey, QUESTION_PROVISIONS } from "@/lib/mawqif/progress";
import type { QuoteView, SituationView } from "@/lib/mawqif/types";
import { cn } from "@/lib/utils";

import { QuoteCard, SourceInFull } from "./quote";
import type { TurnOutcome } from "@/lib/mawqif/turn";

import { RoleplayTurn } from "./roleplay-turn";
import { SituationArt } from "./situation-art";
import { SituationCheck } from "./situation-check";

type Stage = "scene" | "say" | "why" | "when" | "roleplay" | "summary" | "check";
const STEPS = ["scene", "learn", "roleplay", "summary", "check"] as const;
const stepOf = (stage: Stage): (typeof STEPS)[number] => (stage === "say" || stage === "why" || stage === "when" ? "learn" : stage);

/**
 * One situation, one screen at a time: the scene, what to say, why, and when (each quoted from its
 * source), the role-play with feedback after every turn, a short summary, then the check.
 */
export function SituationPlayer({ situation, next }: { situation: SituationView; next: { href: `/${string}`; title: string } | null }) {
  const t = useTranslations("Mawqif");
  const [stage, setStage] = useState<Stage>("scene");
  const [turn, setTurn] = useState(0);
  const [outcomes, setOutcomes] = useState<TurnOutcome[]>([]);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const opened = useRef(false);

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
  const step = stepOf(stage);

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

      {stage === "scene" && (
        <section className="grid gap-5">
          <div className="overflow-hidden rounded-3xl border border-hairline bg-sand">
            <SituationArt art={situation.art} className="mx-auto max-h-64" />
          </div>
          <h2 ref={heading} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
            {t("sceneTitle")}
          </h2>
          <p className="text-lg leading-relaxed">{situation.scene}</p>
          <p className="text-sm text-muted-foreground">
            {t("youWillMeet", { character: situation.character })} · {t("teamWording")}
          </p>
          <Button className="justify-self-start" onClick={() => go("say")}>
            {t("begin")}
            <ArrowRight aria-hidden className="rtl:-scale-x-100" />
          </Button>
        </section>
      )}

      {(stage === "say" || stage === "why" || stage === "when") && (
        <section className="grid gap-4">
          <div className="flex items-center gap-3">
            <RafiqFigure pose="pointing" height={72} decorative className="h-16 w-auto shrink-0" />
            <h2 ref={heading} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
              {t(`learn.${stage}`)}
            </h2>
          </div>
          {situation.learn[stage].map((quote, index) => {
            const item = itemOf(quote);
            return (
              <div key={`${quote.ref}-${index}`} className="grid gap-2">
                <QuoteCard quote={quote} />
                {item && <SourceInFull item={item} />}
              </div>
            );
          })}
          <Button className="justify-self-start" onClick={() => go(stage === "say" ? "why" : stage === "why" ? "when" : "roleplay")}>
            {stage === "when" ? t("startRoleplay") : t("next")}
            <ArrowRight aria-hidden className="rtl:-scale-x-100" />
          </Button>
        </section>
      )}

      {stage === "roleplay" && (
        <section className="grid gap-4">
          <h2 ref={heading} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
            {t("turnTitle", { number: turn + 1, total: situation.exchanges.length })}
          </h2>
          <RoleplayTurn
            key={situation.exchanges[turn]!.id}
            situationId={situation.id}
            exchange={situation.exchanges[turn]!}
            index={turn}
            character={situation.character}
            items={situation.items}
            onDone={(outcome) => {
              setOutcomes((current) => [...current.slice(0, turn), outcome]);
              if (turn + 1 < situation.exchanges.length) {
                setTurn(turn + 1);
                window.scrollTo({ top: 0 });
              } else go("summary");
            }}
          />
        </section>
      )}

      {stage === "summary" && (
        <section className="grid gap-5">
          <h2 ref={heading} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
            {t("summaryTitle")}
          </h2>
          <p>{t("summaryBody", { best: outcomes.filter((outcome) => outcome.quality === "best").length, total: situation.exchanges.length })}</p>
          <h3 className="font-semibold">{t("summarySay")}</h3>
          {situation.learn.say.map((quote, index) => (
            <QuoteCard key={`${quote.ref}-${index}`} quote={quote} />
          ))}
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => go("check")}>
              {t("toCheck")}
              <ArrowRight aria-hidden className="rtl:-scale-x-100" />
            </Button>
            <Button asChild variant="outline">
              <Link href={{ pathname: "/rafiq", query: { ask: t("askAboutSituation", { title: situation.title }) } }}>
                <MessageCircleQuestion aria-hidden />
                {t("askRafiq")}
              </Link>
            </Button>
          </div>
        </section>
      )}

      {stage === "check" && !score && (
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
            }}
          />
        </section>
      )}

      {stage === "check" && score && (
        <section className="grid gap-5">
          <div className="flex flex-wrap items-center gap-5">
            {score.correct === score.total && <Stamp appear ringText={`${situation.title} ·`} center="✓" tone="oasis" rotate={-8} label={t("stampLabel", { title: situation.title })} className="size-28" />}
            <div className="grid gap-1">
              <h2 ref={heading} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
                {t("checkScore", { correct: score.correct, total: score.total })}
              </h2>
              <p>{score.correct === score.total ? t("checkAllRight") : t("checkSome")}</p>
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
            <Button
              variant="ghost"
              onClick={() => {
                setScore(null);
                setOutcomes([]);
                setTurn(0);
                go("scene");
              }}
            >
              {t("practiseAgain")}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
