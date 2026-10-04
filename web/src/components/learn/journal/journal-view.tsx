"use client";

import { Check, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Stamp } from "@/components/journey/stamp";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { Link } from "@/i18n/navigation";
import { gain, ratio } from "@/lib/learn/progress";
import { progressActions, useProgress } from "@/lib/learn/progress-store";

/** `number` is empty for the practice lesson, which is not part of the numbered road. */
export type JournalLesson = { id: string; number: string; title: string; stationId: string };
export type JournalStation = { id: string; title: string };

type JournalViewProps = {
  lessons: readonly JournalLesson[];
  stations: readonly JournalStation[];
  /** The sentences of every "pick one" journal page, by lesson id then item id. */
  pickable: Record<string, Record<string, string>>;
};

export function JournalView({ lessons, stations, pickable }: JournalViewProps) {
  const t = useTranslations("Journal");
  const progress = useProgress();
  const [confirming, setConfirming] = useState(false);

  const completed = lessons.filter((lesson) => progress.completedLessons[lesson.id]);
  const passed = stations.filter((station) => progress.exams[station.id]?.passed);
  const measured = stations.filter((station) => progress.baselines[station.id] || progress.exams[station.id]);
  const quizzes = lessons.filter((lesson) => progress.quizzes[lesson.id]);
  const picks = Object.entries(progress.picks).flatMap(([lessonId, itemId]) => {
    const text = pickable[lessonId]?.[itemId];
    const lesson = lessons.find((candidate) => candidate.id === lessonId);
    return text && lesson ? [{ lesson, text }] : [];
  });
  const isEmpty = completed.length === 0 && measured.length === 0 && picks.length === 0;

  return (
    <div className="grid gap-12">
      {isEmpty && (
        <Card className="px-6 sm:px-8">
          <p className="text-lg">{t("empty")}</p>
          <Button asChild className="justify-self-start">
            <Link href="/learn">{t("toRoad")}</Link>
          </Button>
        </Card>
      )}

      {picks.length > 0 && (
        <section aria-labelledby="journal-picks" className="grid gap-4">
          <SectionHeading id="journal-picks" title={t("picksTitle")} />
          {picks.map(({ lesson, text }) => (
            <figure key={lesson.id} className="rounded-2xl border border-hairline border-s-4 border-s-dawn bg-paper p-6">
              <blockquote className="text-xl leading-relaxed">{text}</blockquote>
              <figcaption className="mt-3 text-sm text-muted-foreground">
                {lesson.number ? t("fromLesson", { number: lesson.number, title: lesson.title }) : lesson.title}
              </figcaption>
            </figure>
          ))}
        </section>
      )}

      {(completed.length > 0 || passed.length > 0) && (
        <section aria-labelledby="journal-stamps" className="grid gap-6">
          <SectionHeading id="journal-stamps" title={t("stampsTitle")} description={t("stampsBody", { count: completed.length })} />
          <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
            {passed.map((station) => (
              <li key={station.id} className="grid justify-items-center gap-2 text-center">
                <Stamp ringText={`${station.title} · ${t("stationStamp")} ·`} icon={Check} tone="oasis" className="size-28" />
                <span className="text-sm font-medium">{station.title}</span>
              </li>
            ))}
            {completed.map((lesson, index) => (
              <li key={lesson.id} className="grid justify-items-center gap-2 text-center">
                <Stamp
                  ringText={`${lesson.title} ·`}
                  center={lesson.number || "✓"}
                  tone={index % 2 === 0 ? "terracotta" : "ink"}
                  rotate={index % 2 === 0 ? -8 : 6}
                  className="size-28"
                />
                <span className="text-sm font-medium">{lesson.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {measured.length > 0 && (
        <section aria-labelledby="journal-gain" className="grid gap-4">
          <SectionHeading id="journal-gain" title={t("gainTitle")} description={t("gainBody")} />
          {measured.map((station) => {
            const baseline = progress.baselines[station.id];
            const exam = progress.exams[station.id];
            const difference = gain(baseline, exam);
            return (
              <Card key={station.id} className="gap-4 px-6 sm:px-8">
                <h3 className="font-display text-xl font-semibold">{station.title}</h3>
                <GainBar label={t("before")} value={baseline ? ratio(baseline) : null} tone="muted" />
                <GainBar label={t("after")} value={exam ? ratio(exam) : null} tone="oasis" />
                <p className="font-medium text-oasis-text">
                  {difference === null ? t("gainPending") : t("gain", { gain: difference })}
                </p>
              </Card>
            );
          })}
        </section>
      )}

      {quizzes.length > 0 && (
        <section aria-labelledby="journal-quizzes" className="grid gap-4">
          <SectionHeading id="journal-quizzes" title={t("quizzesTitle")} />
          <ul className="grid gap-2">
            {quizzes.map((lesson) => {
              const score = progress.quizzes[lesson.id];
              return (
                <li key={lesson.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-hairline bg-paper px-5 py-3">
                  <span>{lesson.number ? t("fromLesson", { number: lesson.number, title: lesson.title }) : lesson.title}</span>
                  <span className="font-semibold">{score && t("score", { correct: score.correct, total: score.total })}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="journal-privacy" className="rounded-2xl border border-dashed border-hairline p-6">
        <h2 id="journal-privacy" className="flex items-center gap-2 font-semibold">
          <ShieldCheck aria-hidden className="size-5 text-oasis-text" />
          {t("privacyTitle")}
        </h2>
        <p className="mt-2 text-muted-foreground">{t("privacyBody")}</p>
        {confirming ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="font-medium">{t("forgetConfirm")}</p>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                progressActions.forget();
                setConfirming(false);
              }}
            >
              {t("forgetYes")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              {t("forgetNo")}
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setConfirming(true)}>
            {t("forget")}
          </Button>
        )}
      </section>
    </div>
  );
}

function GainBar({ label, value, tone }: { label: string; value: number | null; tone: "muted" | "oasis" }) {
  const t = useTranslations("Journal");
  const percent = value === null ? null : Math.round(value * 100);
  return (
    <div className="grid gap-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-semibold">{percent === null ? t("notYetTaken") : `${percent}%`}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-hairline">
        <div
          className={tone === "oasis" ? "h-full rounded-full bg-oasis" : "h-full rounded-full bg-muted-ink"}
          style={{ width: `${percent ?? 0}%` }}
        />
      </div>
    </div>
  );
}
