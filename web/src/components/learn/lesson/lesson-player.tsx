"use client";

import dynamic from "next/dynamic";
import { ArrowRight, BookOpen, ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { ActivityRunner } from "@/components/learn/activities/activity-runner";
import { ListenControls } from "@/components/learn/audio/listen-controls";
import { AssessmentRunner } from "@/components/learn/assessment/assessment-runner";
import { ReviewList } from "@/components/learn/assessment/review-list";
import { ScoreSummary } from "@/components/learn/assessment/score-summary";
import { CardBoard } from "@/components/learn/board/card-board";
import { ChalkBoard } from "@/components/learn/board/chalk-board";
import type { HelpTarget } from "@/components/learn/board/lesson-rafiq-panel";
import { LessonStage } from "@/components/learn/board/lesson-stage";
import { PaperSlip } from "@/components/learn/board/paper-slip";
import { PinnedScene, type SceneState } from "@/components/learn/board/pinned-scene";
import { RafiqAtBoard } from "@/components/learn/board/rafiq-at-board";
import { RafiqReactionProvider } from "@/components/learn/board/rafiq-context";
import { SoundToggle } from "@/components/learn/board/sound-toggle";
import { useRafiqMood } from "@/components/learn/board/use-rafiq-mood";
import { MediaGallery } from "@/components/learn/media-gallery";
import { QuestionCard } from "@/components/learn/questions/question-card";
import { SourceLine } from "@/components/learn/source-line";
import { FiqhNote } from "@/components/learn/wording";
import { SourceLinks } from "@/components/learn/source-links";
import { VideoCard } from "@/components/learn/video-card";
import { Stamp } from "@/components/journey/stamp";
import { Button } from "@/components/ui/button";
import { features } from "@/config/features";
import { PROVISIONS_LIMIT } from "@/config/learning";
import { Link } from "@/i18n/navigation";
import { playPaper, startWater } from "@/lib/audio/natural-sounds";
import { useBoardSounds } from "@/lib/audio/sound-setting";
import { useReadAloud } from "@/lib/audio/speech";
import { progressActions, useProgress } from "@/lib/learn/progress-store";
import { pickProvisions } from "@/lib/learn/provisions";
import type { CardView, LessonView, LessonVisualView, QuestionView } from "@/lib/learn/types";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

import { LessonBanner } from "./lesson-banner";
import { PartStepper, type LessonPart } from "./part-stepper";

// The conversation with Rafiq loads only when the learner opens it.
const LessonRafiqPanel = dynamic(() =>
  import("@/components/learn/board/lesson-rafiq-panel").then((module) => module.LessonRafiqPanel),
);

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
  /** The drawing pinned on the board (content/visuals.json), if the lesson has one. */
  visual: LessonVisualView | null;
  /** Questions from earlier on the road, for the Provisions review. */
  provisionsPool: readonly QuestionView[];
  next: LessonNext;
};

type ActivityState = { board: string; done: number; total: number; focus: number | null };

/**
 * The lesson as an open-air class: each part of the lesson, in its order, is written on a board
 * where Rafiq, the lantern, teaches. The sky moves from night to dawn as the lesson goes on.
 */
export function LessonPlayer({ lesson, visual, provisionsPool, next }: LessonPlayerProps) {
  const t = useTranslations("Lesson");
  const tb = useTranslations("Board");
  const locale = useLocale();
  const progress = useProgress();
  const reduced = useReducedMotion();
  const sounds = useBoardSounds();
  const introSegments = useMemo(() => [lesson.title, ...lesson.objectives], [lesson.title, lesson.objectives]);
  const introReader = useReadAloud(introSegments, locale);
  const screens = useMemo(() => buildScreens(lesson), [lesson]);
  const [index, setIndex] = useState(0);
  /** An earlier card board the learner went back to, while `index` keeps their place. */
  const [review, setReview] = useState<number | null>(null);
  const [provisions, setProvisions] = useState<QuestionView[]>([]);
  const [provisionIndex, setProvisionIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, boolean> | null>(null);
  const [activityState, setActivityState] = useState<ActivityState | null>(null);
  const [writtenBoard, setWrittenBoard] = useState<string | null>(null);
  const [narrate, setNarrate] = useState(false);
  const [help, setHelp] = useState<HelpTarget | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const shown = review ?? index;
  const screen = screens[shown] ?? { kind: "close" };
  const board = `${shown}:${provisionIndex}`;
  const cardBoards = screens.flatMap((candidate, position) => (candidate.kind === "card" ? [position] : []));
  const previousBoard = cardBoards.filter((position) => position < shown).at(-1);
  const nextEarlierBoard = review === null ? undefined : cardBoards.find((position) => position > review && position < index);

  const writing = screen.kind === "card" && review === null && !reduced && writtenBoard !== board;
  const place = screen.kind === "intro" ? "intro" : screen.kind === "close" ? "close" : "board";
  const rafiq = useRafiqMood(board, writing ? "writing" : "idle", place);
  const markWritten = useCallback(() => setWrittenBoard(board), [board]);

  useEffect(() => {
    if (shown === 0 && provisionIndex === 0) return;
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [shown, provisionIndex]);

  useEffect(() => {
    if (screen.kind === "close") progressActions.completeLesson(lesson.id);
  }, [screen.kind, lesson.id]);

  useEffect(() => {
    if (!sounds || visual?.ambience !== "water") return;
    return startWater();
  }, [sounds, visual?.ambience]);

  const parts = useMemo(
    () => [...new Set(screens.map((candidate) => PART_OF[candidate.kind]).filter((part) => part !== null))],
    [screens],
  );

  /** Every move to another board turns the page with a soft paper sound. */
  function turnBoard(move: () => void) {
    if (sounds) playPaper();
    move();
  }

  function advance(chosen = provisions) {
    turnBoard(() => {
      let target = index + 1;
      if (screens[target]?.kind === "provisions" && chosen.length === 0) target += 1;
      setReview(null);
      setIndex(Math.min(target, screens.length - 1));
    });
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

  const goBack = previousBoard === undefined ? undefined : () => turnBoard(() => setReview(previousBoard));
  const goForward = review === null ? undefined : () => turnBoard(() => setReview(nextEarlierBoard ?? null));

  const sceneState: SceneState = (() => {
    switch (screen.kind) {
      case "intro":
      case "provisions":
        return { progress: 0, focus: null };
      case "card":
      case "check":
        return { progress: (screen.index + 1) / Math.max(lesson.cards.length, 1), focus: null };
      case "activity": {
        const state = activityState?.board === board ? activityState : null;
        return { progress: state ? state.done / state.total : 0, focus: state?.focus ?? null };
      }
      default:
        return { progress: 1, focus: null };
    }
  })();

  /** Short interface headings are set in Reem Kufi; titles written in lesson files, which can be long, in the body face. */
  const heading = (text: string, face: "display" | "body" = "display") => (
    <h2
      ref={headingRef}
      tabIndex={-1}
      className={cn(
        "leading-snug font-semibold text-dawn outline-none",
        face === "display" ? "font-display text-2xl sm:text-3xl" : "chalk-text text-xl sm:text-2xl",
      )}
    >
      {text}
    </h2>
  );

  const card: CardView | undefined = screen.kind === "card" || screen.kind === "check" ? lesson.cards[screen.index] : undefined;
  const activity = screen.kind === "activity" ? lesson.activities[screen.index] : undefined;
  const provision = provisions[provisionIndex];
  const pinned = visual && screen.kind !== "activity" && (
    <PinnedScene visual={visual} state={sceneState} className="w-28 shrink-0 sm:w-40" />
  );

  return (
    <RafiqReactionProvider value={rafiq.react}>
      <LessonStage progress={index / Math.max(screens.length - 1, 1)}>
        <div className="tone-night flex items-center justify-between gap-2 rounded-full border border-border bg-background py-1 ps-1 pe-2 text-foreground">
          <Link href="/learn" className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 font-medium hover:bg-accent">
            <ArrowRight aria-hidden className="size-4 ltr:rotate-180" />
            <span className="sr-only sm:not-sr-only">{t("backToRoad")}</span>
          </Link>
          <div className="flex items-center gap-1">
            {PART_OF[screen.kind] && <PartStepper parts={parts} current={PART_OF[screen.kind] ?? "ideas"} />}
            <SoundToggle />
          </div>
        </div>

        {screen.kind === "intro" && lesson.demo && (
          <div className="tone-day mt-4 rounded-xl bg-paper *:mt-0">
            <LessonBanner />
          </div>
        )}

        <div className="mt-6">
          <RafiqAtBoard mood={rafiq.mood} atLessonStart={screen.kind === "intro"} caption={rafiq.caption} />
          <ChalkBoard
            label={lesson.title}
            onSwipeBack={screen.kind === "card" ? goBack : undefined}
            onSwipeForward={screen.kind === "card" ? goForward : undefined}
          >
            <header className="flex items-start justify-between gap-4">
              <div className="grid min-w-0 gap-1.5">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
                  {lesson.demo ? t("practiceLesson") : t("lessonNumber", { number: lesson.id })}
                </p>
                <h1
                  className={cn(
                    "chalk-text leading-snug font-semibold",
                    screen.kind === "intro" ? "text-2xl sm:text-3xl" : "text-base text-muted-foreground",
                  )}
                >
                  {lesson.title}
                </h1>
                {review !== null && <p className="text-sm font-semibold text-dawn">{tb("earlierBoard")}</p>}
                {screen.kind === "card" && heading(tb("boardOf", { current: screen.index + 1, total: lesson.cards.length }))}
              </div>
              {pinned}
            </header>

            {screen.kind === "intro" && (
              <>
                <SourceLine lesson={lesson} />
                {lesson.fiqhNote && <FiqhNote note={lesson.fiqhNote} />}
                {lesson.objectives.length > 0 && (
                  <div className="grid gap-3">
                    <p className="font-display text-xl font-semibold text-dawn">{t("objectivesTitle")}</p>
                    <ul className="chalk-text grid list-inside list-disc gap-1.5 text-lg marker:text-dawn">
                      {lesson.objectives.map((objective, position) => (
                        <li
                          key={objective}
                          className={cn(
                            "decoration-dawn decoration-2 underline-offset-[0.4em]",
                            introReader.current === position + 1 && "underline",
                          )}
                        >
                          {objective}
                        </li>
                      ))}
                    </ul>
                    <ListenControls reader={introReader} />
                  </div>
                )}
                <MediaGallery media={lesson.media} />
                <div>
                  <p className="font-display text-xl font-semibold text-dawn">{t("partsTitle")}</p>
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
                    if (provisionIndex + 1 < provisions.length) turnBoard(() => setProvisionIndex(provisionIndex + 1));
                    else advance();
                  }}
                />
              </>
            )}

            {screen.kind === "card" && card && (
              <>
                <CardBoard
                  key={board}
                  card={card}
                  instant={review !== null || reduced}
                  sounds={sounds}
                  narrate={narrate}
                  onNarrateChange={setNarrate}
                  onWritten={markWritten}
                  onLineHelp={features.rafiq ? (line) => setHelp({ lessonId: lesson.id, cardId: card.id, line }) : undefined}
                />
                <BoardNav>
                  {goBack && (
                    <Button variant="outline" onClick={goBack}>
                      {tb("previousBoard")}
                    </Button>
                  )}
                  {review === null ? (
                    <Button onClick={() => advance()}>{t("continue")}</Button>
                  ) : (
                    <Button onClick={goForward}>{nextEarlierBoard === undefined ? tb("backToCurrent") : tb("nextBoard")}</Button>
                  )}
                </BoardNav>
              </>
            )}

            {screen.kind === "check" && card?.check && (
              <>
                {heading(t("checkTitle"))}
                <QuestionCard key={card.check.id} question={card.check} mode="practice" onAnswered={(correct) => card.check && practiced(card.check, correct)} />
                <PreviousBoard onBack={goBack} />
              </>
            )}

            {screen.kind === "video" && lesson.video && (
              <>
                {heading(t("watchFirst"))}
                <PaperSlip>
                  <VideoCard video={lesson.video} title={t("suggestedVideo")} />
                </PaperSlip>
                <BoardNav>
                  {goBack && (
                    <Button variant="outline" onClick={goBack}>
                      {tb("previousBoard")}
                    </Button>
                  )}
                  <Button onClick={() => advance()}>{t("continue")}</Button>
                </BoardNav>
              </>
            )}

            {activity && (
              <>
                {heading(activity.title, "body")}
                {visual && <PinnedScene visual={visual} state={sceneState} className="mx-auto w-full max-w-72" />}
                <ActivityRunner
                  key={activity.id}
                  activity={activity}
                  lessonId={lesson.id}
                  onDone={() => advance()}
                  onProgressChange={(done, total) =>
                    setActivityState((current) => ({ board, done, total, focus: current?.board === board ? current.focus : null }))
                  }
                  onFocusChange={(focus) =>
                    setActivityState((current) =>
                      current?.board === board ? { ...current, focus } : { board, done: 0, total: 1, focus },
                    )
                  }
                  onLineHelp={features.rafiq ? (line, stepId) => setHelp({ lessonId: lesson.id, cardId: stepId, line }) : undefined}
                />
                <PreviousBoard onBack={goBack} />
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
                  <div role="note" className="grid gap-2 rounded-xl border border-dashed border-border p-4 text-muted-foreground">
                    <p>{lesson.situation.followUp}</p>
                    <Link href="/talk-to-a-specialist" className="justify-self-start font-medium text-foreground underline underline-offset-4">
                      {t("talkToSpecialist")}
                    </Link>
                  </div>
                )}
                <SourceLinks sources={lesson.situation.sources} />
                <PreviousBoard onBack={goBack} />
              </>
            )}

            {screen.kind === "quiz" && (
              <>
                {heading(t("quizTitle"))}
                {quizAnswers ? (
                  <>
                    <ScoreSummary correct={Object.values(quizAnswers).filter(Boolean).length} total={lesson.quiz.length} note={t("quizNote")} />
                    <h3 className="font-display text-xl font-semibold text-dawn">{t("reviewTitle")}</h3>
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
                <SourceLine lesson={lesson} />
                <PaperSlip className="p-6 pe-28 sm:pe-36">
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
                    className="absolute inset-e-3 -top-6 size-24 sm:size-32"
                  />
                </PaperSlip>
                {lesson.readMore.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 justify-self-start font-medium underline underline-offset-4">
                    {t("readFullLesson")}
                    <ExternalLink aria-hidden className="size-4" />
                  </a>
                ))}
                {lesson.laterTopics.length > 0 && (
                  <div className="rounded-2xl border border-dashed border-border p-5">
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
                {lesson.video?.position === "close" && (
                  <PaperSlip>
                    <VideoCard video={lesson.video} title={t("suggestedVideo")} />
                  </PaperSlip>
                )}
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
                <PreviousBoard onBack={goBack} />
              </>
            )}
          </ChalkBoard>
        </div>
      </LessonStage>
      {help && (
        // Its own boundary: the board stays as it is while the panel's code arrives.
        <Suspense fallback={null}>
          <LessonRafiqPanel key={`${help.cardId}:${help.line}`} target={help} onClose={() => setHelp(null)} />
        </Suspense>
      )}
    </RafiqReactionProvider>
  );
}

function BoardNav({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

/** Earlier boards stay within reach from every board. */
function PreviousBoard({ onBack }: { onBack: (() => void) | undefined }) {
  const t = useTranslations("Board");
  if (!onBack) return null;
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex min-h-11 items-center justify-self-start rounded-full px-1 text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
    >
      {t("previousBoard")}
    </button>
  );
}
