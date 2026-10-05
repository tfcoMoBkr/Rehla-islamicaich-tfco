import "server-only";

import type { Locale } from "next-intl";

import type { RoadStation } from "@/lib/learn/road";
import type { QuestionView } from "@/lib/learn/types";

import { lessonHref, lessonQuestions, lessonText, questionView } from "./lesson-view";
import { loadKhutuwat, type Khutuwat, type StationEntry } from "./load";
import type { Lesson, Question } from "./schema";

export type StationContext = {
  station: StationEntry;
  /** The ordered stations this one belongs to: the main road, or a practice station alone. */
  route: StationEntry[];
  khutuwat: Khutuwat;
};

export async function getStationContext(stationId: string): Promise<StationContext | null> {
  const khutuwat = await loadKhutuwat();
  const onRoad = khutuwat.road.find((station) => station.id === stationId);
  if (onRoad) return { station: onRoad, route: khutuwat.road, khutuwat };
  const alone = khutuwat.practice.find((station) => station.id === stationId);
  return alone ? { station: alone, route: [alone], khutuwat } : null;
}

export function findLesson({ station, khutuwat }: StationContext, slug: string): Lesson | undefined {
  return station.lessonIds.map((id) => khutuwat.lessons.get(id)).find((lesson) => lesson?.slug === slug);
}

export function toRoadStations({ route, khutuwat }: StationContext): RoadStation[] {
  return route.map((station) => ({
    id: station.id,
    lessons: station.lessonIds.flatMap((id) => {
      const lesson = khutuwat.lessons.get(id);
      return lesson ? [{ id, slug: lesson.slug }] : [];
    }),
    hasBaseline: station.baseline.length > 0,
    hasExam: station.exam.length > 0,
  }));
}

/** Station questions quote the card they name, when they name one. */
function stationQuestionView(question: Question, station: StationEntry, khutuwat: Khutuwat, locale: Locale): QuestionView {
  const lesson = question.lesson ? khutuwat.lessons.get(question.lesson) : undefined;
  const card = lesson?.cards.find((candidate) => candidate.id === question.card);
  return questionView(question, question.lesson ?? station.id, card ? lessonText(card, locale) : null, locale);
}

export function stationQuestions(context: StationContext, part: "baseline" | "exam", locale: Locale): QuestionView[] {
  return context.station[part].map((question) => stationQuestionView(question, context.station, context.khutuwat, locale));
}

/** Everything the learner may already have met before this lesson: earlier lessons and baselines. */
export function earlierQuestions({ route, khutuwat }: StationContext, lessonId: string, locale: Locale): QuestionView[] {
  const pool: QuestionView[] = [];
  for (const station of route) {
    pool.push(...station.baseline.map((question) => stationQuestionView(question, station, khutuwat, locale)));
    for (const id of station.lessonIds) {
      if (id === lessonId) return pool;
      const lesson = khutuwat.lessons.get(id);
      if (lesson) pool.push(...lessonQuestions(lesson, locale));
    }
  }
  return pool;
}

/** Every earlier question of a station, for the review of missed ones before its exam. */
export function stationReviewPool(context: StationContext, locale: Locale): QuestionView[] {
  const { station, khutuwat } = context;
  return [
    ...stationQuestions(context, "baseline", locale),
    ...station.lessonIds.flatMap((id) => {
      const lesson = khutuwat.lessons.get(id);
      return lesson ? lessonQuestions(lesson, locale) : [];
    }),
  ];
}

export type NextAfterLesson = { href: string; kind: "lesson" | "exam" | "road" };

export function nextAfterLesson({ station, khutuwat }: StationContext, lessonId: string): NextAfterLesson {
  const following = khutuwat.lessons.get(station.lessonIds[station.lessonIds.indexOf(lessonId) + 1] ?? "");
  if (following) return { href: lessonHref(following), kind: "lesson" };
  if (station.exam.length > 0) return { href: `/learn/${station.id}/exam`, kind: "exam" };
  return { href: "/learn", kind: "road" };
}

/** Where the road continues once a station's exam is passed. */
export function afterExam({ route, khutuwat }: StationContext, stationId: string): string {
  const next = route[route.findIndex((station) => station.id === stationId) + 1];
  if (!next) return "/learn/journal";
  if (next.baseline.length > 0) return `/learn/${next.id}/check`;
  const first = khutuwat.lessons.get(next.lessonIds[0] ?? "");
  return first ? lessonHref(first) : "/learn";
}

/** Every station with a page of its own (the road and the practice road), for static rendering. */
export async function stationParams(): Promise<{ station: string }[]> {
  const { road, practice } = await loadKhutuwat();
  return [...road, ...practice].map((station) => ({ station: station.id }));
}

/** Every lesson's URL segments, for static rendering. */
export async function lessonParams(): Promise<{ station: string; lesson: string }[]> {
  const { lessons } = await loadKhutuwat();
  return [...lessons.values()].map((lesson) => ({ station: lesson.station, lesson: lesson.slug }));
}
