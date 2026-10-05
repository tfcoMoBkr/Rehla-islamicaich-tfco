"use client";

import { BookOpen, Check, Signpost } from "lucide-react";
import { useTranslations } from "next-intl";

import { DemoBadge } from "@/components/learn/content-badges";
import { RoadJourney } from "@/components/journey/road-journey";
import { Station, type StationState } from "@/components/journey/station";
import { RafiqFigure } from "@/components/rafiq/rafiq-figure";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { gain } from "@/lib/learn/progress";
import { progressActions, useProgress } from "@/lib/learn/progress-store";
import { nextStep, stationStatuses, stepHref, type RoadStation } from "@/lib/learn/road";
import type { StationView } from "@/lib/learn/types";

import { ContinueCard } from "./continue-card";
import { StartChooser } from "./start-chooser";

function toRoadStation(station: StationView): RoadStation {
  return {
    id: station.id,
    lessons: station.lessons.map(({ id, slug }) => ({ id, slug })),
    hasBaseline: station.hasBaseline,
    hasExam: station.hasExam,
  };
}

type LearnRoadProps = {
  road: readonly StationView[];
  practice: readonly StationView[];
};

export function LearnRoad({ road, practice }: LearnRoadProps) {
  const t = useTranslations("Learn");
  const progress = useProgress();
  const roadStations = road.map(toRoadStation);
  const statuses = stationStatuses(roadStations, progress);
  const step = nextStep(roadStations, progress);

  return (
    <div className="grid gap-12">
      {progress.startStation === null ? (
        <StartChooser stations={road} />
      ) : (
        <ContinueCard step={step} road={road} />
      )}

      {road.length > 0 && (
        <RoadJourney className="[--road-bed-from:var(--hairline)] [--road-from:var(--night)] [--road-via:var(--muted-ink)]">
          <ol className="grid gap-10 pt-10 md:gap-6">
            {road.map((station, index) => (
              <RoadStationStops
                key={station.id}
                station={station}
                number={index + 1}
                status={statuses[index] ?? "locked"}
                previousTitle={road[index - 1]?.title}
                nextLessonId={step.kind === "lesson" && step.stationId === station.id ? step.lessonId : null}
                stationIsNext={(step.kind === "baseline" || step.kind === "exam") && step.stationId === station.id}
              />
            ))}
          </ol>
        </RoadJourney>
      )}

      {practice.map((station) => (
        <PracticeCard key={station.id} station={station} />
      ))}

      <Button asChild variant="outline" className="justify-self-start">
        <Link href="/learn/journal">
          <BookOpen aria-hidden />
          {t("openJournal")}
        </Link>
      </Button>
    </div>
  );
}

type RoadStationStopsProps = {
  station: StationView;
  number: number;
  status: StationState;
  previousTitle?: string;
  nextLessonId: string | null;
  /** The next step is this station's "what do I know?" check or its exam. */
  stationIsNext: boolean;
};

/** Rafiq walks beside the learner's next stop on the road. */
const walkingRafiq = <RafiqFigure pose="walking" height={88} className="rtl:-scale-x-100" />;

function RoadStationStops({ station, number, status, previousTitle, nextLessonId, stationIsNext }: RoadStationStopsProps) {
  const t = useTranslations("Learn");
  const progress = useProgress();
  const locked = status === "locked";
  const stationGain = gain(progress.baselines[station.id], progress.exams[station.id]);

  return (
    <>
      <Station
        side="start"
        state={status}
        stateLabel={t(`status.${status}`)}
        icon={<span className="font-display text-lg font-bold">{number}</span>}
        label={t("stationLabel", { number })}
        title={station.title}
        companion={stationIsNext ? walkingRafiq : undefined}
      >
        <p>{t("lessonCount", { count: station.lessons.length })}</p>
        {locked ? (
          <div className="mt-3 grid gap-3">
            {previousTitle && <p>{t("lockedHint", { station: previousTitle })}</p>}
            <Button variant="outline" size="sm" className="justify-self-start" onClick={() => progressActions.chooseStart(station.id)}>
              {t("startHereInstead")}
            </Button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {station.hasBaseline && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/learn/${station.id}/check`}>
                  {progress.baselines[station.id] && <Check aria-hidden />}
                  {t("baselineLink")}
                </Link>
              </Button>
            )}
            {station.hasExam && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/learn/${station.id}/exam`}>
                  {status === "completed" && <Check aria-hidden />}
                  {t("examLink")}
                </Link>
              </Button>
            )}
          </div>
        )}
        {stationGain !== null && <p className="mt-3 font-medium text-oasis-text">{t("gainLine", { gain: stationGain })}</p>}
      </Station>

      {station.lessons.map((lesson, index) => {
        const completed = Boolean(progress.completedLessons[lesson.id]);
        const state: StationState = locked
          ? "locked"
          : completed
            ? "completed"
            : lesson.id === nextLessonId
              ? "current"
              : "open";
        return (
          <Station
            key={lesson.id}
            side={index % 2 === 0 ? "end" : "start"}
            size="sm"
            state={state}
            stateLabel={t(`status.${state}`)}
            icon={lesson.id}
            href={locked ? undefined : `/learn/${station.id}/${lesson.slug}`}
            title={lesson.title}
            companion={state === "current" ? walkingRafiq : undefined}
            meta={
              <>
                {lesson.hasQuiz && (
                  <span className="rounded-full bg-dawn/15 px-2 py-0.5 text-xs font-semibold text-ink">{t("quizBadge")}</span>
                )}
              </>
            }
          />
        );
      })}
    </>
  );
}

function PracticeCard({ station }: { station: StationView }) {
  const t = useTranslations("Learn");
  const progress = useProgress();
  const step = nextStep([toRoadStation(station)], progress);
  const firstLesson = station.lessons[0];

  return (
    <Card className="gap-4 border-s-4 border-s-oasis px-6 sm:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <Signpost aria-hidden className="size-5 text-oasis-text" />
        <DemoBadge />
      </div>
      <h2 className="font-display text-2xl font-semibold">{t("practiceTitle", { title: station.title })}</h2>
      <p className="text-muted-foreground">{t("practiceBody")}</p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href={stepHref(step)}>{t("practiceStart")}</Link>
        </Button>
        {firstLesson && (
          <Button asChild variant="outline">
            <Link href={`/learn/${station.id}/${firstLesson.slug}`}>{t("practiceLesson")}</Link>
          </Button>
        )}
      </div>
    </Card>
  );
}
