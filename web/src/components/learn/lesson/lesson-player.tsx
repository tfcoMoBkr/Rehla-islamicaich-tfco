"use client";

import { ArrowRight, BookOpen, ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { ActivityRunner } from "@/components/learn/activities/activity-runner";
import { ListenControls } from "@/components/learn/audio/listen-controls";
import { ListenableText } from "@/components/learn/audio/listenable-text";
import { AssessmentRunner } from "@/components/learn/assessment/assessment-runner";
import { ReviewList } from "@/components/learn/assessment/review-list";
import { ScoreSummary } from "@/components/learn/assessment/score-summary";
import { EvidenceBlock } from "@/components/learn/evidence-block";
import { MediaGallery } from "@/components/learn/media-gallery";
import { QuestionCard } from "@/components/learn/questions/question-card";
import { SourceLine } from "@/components/learn/source-line";
import { SourceLinks } from "@/components/learn/source-links";
import { VideoCard } from "@/components/learn/video-card";
import { Stamp } from "@/components/journey/stamp";
import { Button } from "@/components/ui/button";
import { PROVISIONS_LIMIT } from "@/config/learning";
import { Link } from "@/i18n/navigation";
import { progressActions, useProgress } from "@/lib/learn/progress-store";
import { useReadAloud } from "@/lib/audio/speech";
import { pickProvisions } from "@/lib/learn/provisions";
import type { CardView, LessonView, QuestionView } from "@/lib/learn/types";

import { LessonBanner } from "./lesson-banner";
import { LessonCover } from "./lesson-cover";
import { PartStepper, type LessonPart } from "./part-stepper";

type Screen =
  | { kind: "intro" }
  | { kind: "provisions" }
  | { kind: "card"; index: number }
  | { kind: "check"; index: number }
  | { kind: "video" }
  | { kind: "activity"; index: number }
  | { kind: "situation" }
  | { kind: "quiz" }
  | { kind: "close" };

const PART_OF: Record<Screen["kind"], LessonPart | null> = {
  intro: null,
  provisions: "recap",
  card: "ideas",
  check: "ideas",
  video: "activity",
  activity: "activity",
  situation: "situation",
  quiz: "close",
  close: "close",
};

function buildScreens(lesson: LessonView): Screen[] {
  const screens: Screen[] = [{ kind: "intro" }, { kind: "provisions" }];
  lesson.cards.forEach((card, index) => {
    screens.push({ kind: "card", index });
    if (card.check) screens.push({ kind: "check", index });
  });
  if (lesson.video?.position === "beforeActivity") screens.push({ kind: "video" });
  lesson.activities.forEach((_, index) => screens.push({ kind: "activity", index }));
  if (lesson.situation) screens.push({ kind: "situation" });
  if (lesson.quiz.length > 0) screens.push({ kind: "quiz" });
  screens.push({ kind: "close" });
  return screens;
}

export type LessonNext = { href: string; kind: "lesson" | "exam" | "road" };

type LessonPlayerProps = {
  lesson: LessonView;
  /** Questions from earlier on the road, for the Provisions review. */
  provisionsPool: readonly QuestionView[];
  next: LessonNext;
};

export function LessonPlayer({ lesson, provisionsPool, next }: LessonPlayerProps) {
  const t = useTranslations("Lesson");
  const locale = useLocale();
  const progress = useProgress();
  const introSegments = useMemo(() => [lesson.title, ...lesson.objectives], [lesson.title, lesson.objectives]);
  const introReader = useReadAloud(introSegments, locale);
  const screens = useMemo(() => buildScreens(lesson), [lesson]);
  const [index, setIndex] = useState(0);
  const [provisions, setProvisions] = useState<QuestionView[]>([]);
  const [provisionIndex, setProvisionIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, boolean> | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const screen = screens[index] ?? { kind: "close" };

  useEffect(() => {
    if (index === 0) return;
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [index, provisionIndex]);

  useEffect(() => {
    if (screen.kind === "close") progressActions.completeLesson(lesson.id);
  }, [screen.kind, lesson.id]);

  const parts = useMemo(
    () => [...new Set(screens.map((candidate) => PART_OF[candidate.kind]).filter((part) => part !== null))],
    [screens],
  );

  function advance(chosen = provisions) {
    let target = index + 1;
    if (screens[target]?.kind === "provisions" && chosen.length === 0) target += 1;
    setIndex(Math.min(target, screens.length - 1));
  }

  function begin() {
    const own = new Set([
      ...lesson.cards.flatMap((card) => (card.check ? [card.check.id] : [])),
      ...(lesson.situation ? [lesson.situation.question.id] : []),
      ...lesson.quiz.map((question) => question.id),
    ]);
    const chosen = pickProvisions(provisionsPool, progress, own, PROVISIONS_LIMIT);
    setProvisions(chosen);
    advance(chosen);
  }

  function practiced(question: QuestionView, correct: boolean) {
    progressActions.answer(question.id, correct);
    advance();
  }

  const heading = (text: string) => (
    <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl leading-snug font-semibold outline-none sm:text-3xl">
      {text}
    </h2>
  );

  const currentPart = PART_OF[screen.kind];
  const card: CardView | undefined = screen.kind === "card" || screen.kind === "check" ? lesson.cards[screen.index] : undefined;
  const activity = screen.kind === "activity" ? lesson.activities[screen.index] : undefined;
  const provision = provisions[provisionIndex];

  return (
    <div className="mx-auto max-w-2xl px-4 pt-12 pb-32 sm:px-6 md:pt-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/learn" className="inline-flex min-h-11 items-center gap-2 rounded-md font-medium text-muted-foreground hover:text-foreground">
          <ArrowRight aria-hidden className="size-4 ltr:rotate-180" />
          {t("backToRoad")}
        </Link>
        {currentPart && <PartStepper parts={parts} current={currentPart} />}
      </div>

      <LessonBanner lesson={lesson} showDetails={screen.kind === "intro"} />

      <header className="mt-6 grid gap-3">
        {screen.kind === "intro" && <LessonCover motifs={lesson.cover} className="mb-3" />}
        <p className="text-sm font-medium text-muted-foreground">{lesson.demo ? t("practiceLesson") : t("lessonNumber", { number: lesson.id })}</p>
        <h1 className={screen.kind === "intro" ? "font-display text-3xl leading-tight font-semibold sm:text-4xl" : "font-display text-xl font-semibold"}>
          {lesson.title}
        </h1>
        {(screen.kind === "intro" || screen.kind === "close") && <SourceLine lesson={lesson} />}
      </header>

      <section className="mt-10 grid gap-6">
        {screen.kind === "intro" && (
          <>
            {lesson.objectives.length > 0 && (
              <div className="grid gap-4 rounded-2xl border border-hairline bg-paper p-6">
                <div>
                  <p className="font-semibold">{t("objectivesTitle")}</p>
                  <ul className="mt-3 grid list-inside list-disc gap-1.5 marker:text-dawn">
                    {lesson.objectives.map((objective, index) => (
                      <li
                        key={objective}
                        className={introReader.current === index + 1 ? "rounded-sm bg-dawn/25 transition-colors" : "transition-colors"}
                      >
                        {objective}
                      </li>
                    ))}
                  </ul>
                </div>
                <ListenControls reader={introReader} />
              </div>
            )}
            <MediaGallery media={lesson.media} />
            <div className="rounded-2xl border border-hairline bg-paper p-6">
              <p className="font-semibold">{t("partsTitle")}</p>
              <ol className="mt-3 grid gap-2">
                {parts.map((part, position) => (
                  <li key={part} className="flex items-center gap-3">
                    <span className="grid size-7 place-items-center rounded-full border border-dawn text-sm font-semibold">{position + 1}</span>
                    {t(`parts.${part}`)}
                  </li>
                ))}
              </ol>
            </div>
            <Button size="lg" className="justify-self-start" onClick={begin}>
              {t("begin")}
            </Button>
          </>
        )}

        {screen.kind === "provisions" && provision && (
          <>
            {heading(t("provisionsTitle"))}
            <p className="text-muted-foreground">
              {t("provisionsIntro")} · {t("itemOf", { current: provisionIndex + 1, total: provisions.length })}
            </p>
            <QuestionCard
              key={provision.id}
              question={provision}
              mode="practice"
              onAnswered={(correct) => {
                progressActions.answer(provision.id, correct);
                if (provisionIndex + 1 < provisions.length) setProvisionIndex(provisionIndex + 1);
                else advance();
              }}
            />
          </>
        )}

        {screen.kind === "card" && card && (
          <>
            {heading(t("cardOf", { current: screen.index + 1, total: lesson.cards.length }))}
            {card.evidenceFirst && card.evidence && <EvidenceBlock evidence={card.evidence} />}
            <div
              key={card.id}
              className="animate-card-in relative grid gap-4 overflow-hidden rounded-2xl border border-hairline bg-paper p-6 ps-7 before:absolute before:inset-y-0 before:start-0 before:w-1.5 before:bg-dawn"
            >
              <ListenableText text={card.text} className="text-xl leading-relaxed" />
            </div>
            <MediaGallery media={card.media} />
            {!card.evidenceFirst && card.evidence && <EvidenceBlock evidence={card.evidence} />}
            <SourceLinks sources={card.sources} />
            <Button className="justify-self-start" onClick={() => advance()}>
              {t("continue")}
            </Button>
          </>
        )}

        {screen.kind === "check" && card?.check && (
          <>
            {heading(t("checkTitle"))}
            <QuestionCard key={card.check.id} question={card.check} mode="practice" onAnswered={(correct) => card.check && practiced(card.check, correct)} />
          </>
        )}

        {screen.kind === "video" && lesson.video && (
          <>
            {heading(t("watchFirst"))}
            <VideoCard video={lesson.video} title={t("suggestedVideo")} />
            <Button className="justify-self-start" onClick={() => advance()}>
              {t("continue")}
            </Button>
          </>
        )}

        {activity && (
          <>
            {heading(activity.title)}
            <ActivityRunner key={activity.id} activity={activity} lessonId={lesson.id} onDone={() => advance()} />
          </>
        )}

        {screen.kind === "situation" && lesson.situation && (
          <>
            {heading(t("situationTitle"))}
            <QuestionCard
              question={lesson.situation.question}
              mode="practice"
              onAnswered={(correct) => lesson.situation && practiced(lesson.situation.question, correct)}
            />
            {lesson.situation.followUp && (
              <div role="note" className="grid gap-2 rounded-xl border border-dashed border-hairline p-4 text-muted-foreground">
                <p>{lesson.situation.followUp}</p>
                <Link href="/talk-to-a-human" className="justify-self-start font-medium text-foreground underline underline-offset-4">
                  {t("talkToHuman")}
                </Link>
              </div>
            )}
            <SourceLinks sources={lesson.situation.sources} />
          </>
        )}

        {screen.kind === "quiz" && (
          <>
            {heading(t("quizTitle"))}
            {quizAnswers ? (
              <>
                <ScoreSummary correct={Object.values(quizAnswers).filter(Boolean).length} total={lesson.quiz.length} note={t("quizNote")} />
                <h3 className="font-display text-xl font-semibold">{t("reviewTitle")}</h3>
                <ReviewList questions={lesson.quiz} answers={quizAnswers} />
                <Button className="justify-self-start" onClick={() => advance()}>
                  {t("continue")}
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">{t("quizIntro")}</p>
                <AssessmentRunner
                  questions={lesson.quiz}
                  onFinish={(answers) => {
                    progressActions.saveQuiz(lesson.id, answers);
                    setQuizAnswers(answers);
                  }}
                />
              </>
            )}
          </>
        )}

        {screen.kind === "close" && (
          <>
            {heading(t("closeTitle"))}
            <div className="relative rounded-2xl border border-hairline bg-paper p-6 pe-28 sm:pe-36">
              <p className="text-sm font-medium text-muted-foreground">{t("learnedTitle")}</p>
              <ul className="mt-2 grid list-inside list-disc gap-1 marker:text-oasis">
                {lesson.objectives.map((objective) => (
                  <li key={objective}>{objective}</li>
                ))}
              </ul>
              <Stamp
                appear
                ringText={`${lesson.title} · ${t("stampRing")} ·`}
                center={lesson.demo ? "✓" : lesson.id}
                tone="oasis"
                rotate={-8}
                label={t("stampLabel", { title: lesson.title })}
                className="absolute end-3 -top-6 size-24 sm:size-32"
              />
            </div>
            {lesson.readMore.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 justify-self-start font-medium underline underline-offset-4">
                {t("readFullLesson")}
                <ExternalLink aria-hidden className="size-4" />
              </a>
            ))}
            {lesson.laterTopics.length > 0 && (
              <div className="rounded-2xl border border-dashed border-hairline p-5">
                <p className="font-semibold">{t("laterTitle")}</p>
                <ul className="mt-2 grid gap-1">
                  {lesson.laterTopics.map((topic) => (
                    <li key={topic.topic}>
                      {topic.topic} ·{" "}
                      {topic.href ? (
                        <Link href={topic.href} className="underline underline-offset-4">
                          {t("lessonNumber", { number: topic.number })}
                        </Link>
                      ) : (
                        t("lessonNumber", { number: topic.number })
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {lesson.video?.position === "close" && <VideoCard video={lesson.video} title={t("suggestedVideo")} />}
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href={next.href}>
                  {t(`next.${next.kind}`)}
                  <ArrowRight aria-hidden className="rtl:-scale-x-100" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/learn/journal">
                  <BookOpen aria-hidden />
                  {t("openJournal")}
                </Link>
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
