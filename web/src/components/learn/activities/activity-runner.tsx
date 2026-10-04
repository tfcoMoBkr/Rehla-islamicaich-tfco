"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Feedback } from "@/components/learn/feedback";
import { MatchBoard } from "@/components/learn/interactions/match-board";
import { SequenceBuilder } from "@/components/learn/interactions/sequence-builder";
import { SortDeck } from "@/components/learn/interactions/sort-deck";
import { TrailProgress } from "@/components/learn/trail-progress";
import { Button } from "@/components/ui/button";
import type { ActivityView } from "@/lib/learn/types";

import { AyahByAyah } from "./ayah-by-ayah";
import { CasesActivity } from "./cases-activity";
import { ChecklistActivity } from "./checklist-activity";
import { DayArc } from "./day-arc";
import { DecisionPath } from "./decision-path";
import { GuidedWalk } from "./guided-walk";
import { ReflectionActivity } from "./reflection-activity";
import { SelectActivity } from "./select-activity";

type ActivityRunnerProps = {
  activity: ActivityView;
  lessonId: string;
  onDone: () => void;
  /** How far the learner is, for the drawing pinned beside the activity. */
  onProgressChange?: (done: number, total: number) => void;
  /** The step in focus, where an activity has one (the day arc's sun). */
  onFocusChange?: (step: number) => void;
  /** "I didn't understand" for a line the activity teaches (the guided walk's steps). */
  onLineHelp?: (line: string, stepId: string) => void;
};

/** Activities finished before moving on; the others can be left at the learner's pace. */
const MUST_FINISH = new Set<ActivityView["type"]>(["order", "timeline", "match", "sort", "swipe", "select", "selectCases", "guided"]);

/** How many steps make up an activity, for the trail that shows its progress. */
function stepsIn(activity: ActivityView): number {
  switch (activity.type) {
    case "order":
    case "timeline":
    case "sort":
    case "swipe":
      return activity.items.length;
    case "select":
      return activity.items.filter((item) => item.correct).length;
    case "selectCases":
      return activity.cases.length;
    case "match":
      return activity.pairs.length;
    case "checklist":
      return activity.quiz ? 1 : activity.items.length;
    case "reflection":
      return 1;
    case "guided":
      return activity.steps.length;
    case "decisionPath":
      return activity.steps.length;
    case "dayArc":
      return activity.stops.length;
    case "ayahByAyah":
      return activity.ayahs.lines.length;
  }
}

/** Renders whichever reusable activity the lesson file names. No lesson has its own code. */
export function ActivityRunner({
  activity,
  lessonId,
  onDone,
  onProgressChange,
  onFocusChange,
  onLineHelp,
}: ActivityRunnerProps) {
  const t = useTranslations("Activity");
  const [completed, setCompleted] = useState(false);
  const [progress, setProgress] = useState(0);
  const seed = `${lessonId}:${activity.id}`;
  const total = Math.max(stepsIn(activity), 1);
  const finished = completed || progress >= total;
  const report = (done: number) => {
    setProgress(done);
    onProgressChange?.(done, total);
  };
  const finish = () => {
    setCompleted(true);
    report(total);
  };

  return (
    <div className="grid gap-6">
      {activity.instruction && <p className="text-lg text-muted-foreground">{activity.instruction}</p>}
      <TrailProgress value={progress / total} done={finished} />

      {activity.type === "order" && (
        <SequenceBuilder items={activity.items} seed={seed} onComplete={finish} onProgress={report} />
      )}
      {activity.type === "timeline" && (
        <SequenceBuilder items={activity.items} seed={seed} variant="road" onComplete={finish} onProgress={report} />
      )}
      {activity.type === "sort" && (
        <SortDeck groups={activity.groups} items={activity.items} seed={seed} onComplete={finish} onProgress={report} />
      )}
      {activity.type === "swipe" && (
        <SortDeck
          groups={[
            { id: "left", label: activity.left },
            { id: "right", label: activity.right },
          ]}
          items={activity.items.map((item) => ({ ...item, group: item.side }))}
          seed={seed}
          variant="swipe"
          onComplete={finish}
          onProgress={report}
        />
      )}
      {activity.type === "select" && (
        <SelectActivity activity={activity} seed={seed} onComplete={finish} onProgress={report} />
      )}
      {activity.type === "selectCases" && <CasesActivity activity={activity} onComplete={finish} onProgress={report} />}
      {activity.type === "match" && (
        <MatchBoard
          pairs={activity.pairs}
          seed={seed}
          repeatedRight={activity.repeatedRight}
          leftIsQuran={activity.leftIsQuran}
          onComplete={finish}
          onProgress={report}
        />
      )}
      {activity.type === "checklist" && (
        <ChecklistActivity activity={activity} lessonId={lessonId} onComplete={finish} onProgress={report} />
      )}
      {activity.type === "reflection" && <ReflectionActivity activity={activity} lessonId={lessonId} onChoose={finish} />}
      {activity.type === "guided" && (
        <GuidedWalk steps={activity.steps} note={activity.note} onFinish={finish} onProgress={report} onLineHelp={onLineHelp} />
      )}
      {activity.type === "decisionPath" && <DecisionPath activity={activity} onComplete={finish} onProgress={report} />}
      {activity.type === "dayArc" && <DayArc activity={activity} onProgress={report} onFocus={onFocusChange} />}
      {activity.type === "ayahByAyah" && <AyahByAyah ayahs={activity.ayahs} onProgress={report} />}

      {finished && MUST_FINISH.has(activity.type) && <Feedback tone="right">{t("wellDone")}</Feedback>}

      <Button className="justify-self-start" onClick={onDone} disabled={MUST_FINISH.has(activity.type) && !finished}>
        {t("continue")}
      </Button>
    </div>
  );
}
