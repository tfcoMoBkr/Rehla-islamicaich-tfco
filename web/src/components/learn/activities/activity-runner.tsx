"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Feedback } from "@/components/learn/feedback";
import { MatchBoard } from "@/components/learn/interactions/match-board";
import { SequenceBuilder } from "@/components/learn/interactions/sequence-builder";
import { SortDeck } from "@/components/learn/interactions/sort-deck";
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
};

/** Activities that are solved before moving on; the others are explored at the learner's pace. */
const SOLVED = new Set<ActivityView["type"]>(["order", "timeline", "match", "sort", "swipe", "select", "selectCases", "guided"]);

/** Renders whichever reusable activity the lesson file names. No lesson has its own code. */
export function ActivityRunner({ activity, lessonId, onDone }: ActivityRunnerProps) {
  const t = useTranslations("Activity");
  const [finished, setFinished] = useState(false);
  const seed = `${lessonId}:${activity.id}`;
  const finish = () => setFinished(true);

  return (
    <div className="grid gap-6">
      {activity.instruction && <p className="text-lg text-muted-foreground">{activity.instruction}</p>}

      {activity.type === "order" && <SequenceBuilder items={activity.items} seed={seed} onComplete={finish} />}
      {activity.type === "timeline" && (
        <SequenceBuilder items={activity.items} seed={seed} variant="road" onComplete={finish} />
      )}
      {activity.type === "sort" && <SortDeck groups={activity.groups} items={activity.items} seed={seed} onComplete={finish} />}
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
        />
      )}
      {activity.type === "select" && <SelectActivity activity={activity} seed={seed} onComplete={finish} />}
      {activity.type === "selectCases" && <CasesActivity activity={activity} onComplete={finish} />}
      {activity.type === "match" && (
        <MatchBoard
          pairs={activity.pairs}
          seed={seed}
          repeatedRight={activity.repeatedRight}
          leftIsQuran={activity.leftIsQuran}
          onComplete={finish}
        />
      )}
      {activity.type === "checklist" && <ChecklistActivity activity={activity} lessonId={lessonId} onComplete={finish} />}
      {activity.type === "reflection" && <ReflectionActivity activity={activity} lessonId={lessonId} />}
      {activity.type === "guided" && <GuidedWalk steps={activity.steps} note={activity.note} onFinish={finish} />}
      {activity.type === "decisionPath" && <DecisionPath activity={activity} onComplete={finish} />}
      {activity.type === "dayArc" && <DayArc activity={activity} onExplored={finish} />}
      {activity.type === "ayahByAyah" && <AyahByAyah ayahs={activity.ayahs} onExplored={finish} />}

      {finished && SOLVED.has(activity.type) && <Feedback tone="right">{t("wellDone")}</Feedback>}

      <Button className="justify-self-start" onClick={onDone} disabled={SOLVED.has(activity.type) && !finished}>
        {t("continue")}
      </Button>
    </div>
  );
}
