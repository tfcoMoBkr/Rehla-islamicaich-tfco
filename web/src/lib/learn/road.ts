import type { Progress } from "./progress";

export type StationStatus = "locked" | "open" | "current" | "completed";

export type RoadStation = {
  id: string;
  lessons: readonly { id: string; slug: string }[];
  hasBaseline: boolean;
  hasExam: boolean;
};

/**
 * A station is open when it is at or before the learner's chosen starting point, or when
 * the station before it has been completed by passing its exam. "Current" is the first open,
 * unfinished station from the starting point on.
 */
export function stationStatuses(stations: readonly RoadStation[], progress: Progress): StationStatus[] {
  const chosen = stations.findIndex((station) => station.id === progress.startStation);
  const start = Math.max(chosen, 0);
  const completed = stations.map((station) => progress.exams[station.id]?.passed === true);
  const open = stations.map((_, index) => index <= start || completed[index - 1] === true);
  const current = stations.findIndex((_, index) => index >= start && open[index] && !completed[index]);

  return stations.map((_, index) => {
    if (completed[index]) return "completed";
    if (!open[index]) return "locked";
    return index === current ? "current" : "open";
  });
}

export type NextStep =
  | { kind: "baseline"; stationId: string }
  | { kind: "lesson"; stationId: string; lessonId: string; slug: string }
  | { kind: "exam"; stationId: string }
  | { kind: "rest" };

/** The one clear next step on the road ("continue your road"). */
export function nextStep(stations: readonly RoadStation[], progress: Progress): NextStep {
  const statuses = stationStatuses(stations, progress);
  const station = stations[statuses.indexOf("current")];
  if (!station) return { kind: "rest" };

  if (station.hasBaseline && !progress.baselines[station.id]) {
    return { kind: "baseline", stationId: station.id };
  }
  const lesson = station.lessons.find(({ id }) => !progress.completedLessons[id]);
  if (lesson) return { kind: "lesson", stationId: station.id, lessonId: lesson.id, slug: lesson.slug };
  if (station.hasExam) return { kind: "exam", stationId: station.id };
  return { kind: "rest" };
}

/** Where a step lives in the app. */
export function stepHref(step: NextStep): string {
  switch (step.kind) {
    case "baseline":
      return `/learn/${step.stationId}/check`;
    case "lesson":
      return `/learn/${step.stationId}/${step.slug}`;
    case "exam":
      return `/learn/${step.stationId}/exam`;
    case "rest":
      return "/learn/journal";
  }
}
