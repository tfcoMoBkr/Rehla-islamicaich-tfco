import "server-only";

import type { Locale } from "next-intl";

import { lessonHref, lessonQuestions, situationId, toLessonView } from "@/lib/content/lesson-view";
import { loadFiqhEncyclopedia, loadKhutuwat, loadSources, loadVisuals } from "@/lib/content/load";
import type { Lesson } from "@/lib/content/schema";
import type { ActivityView, QuestionView } from "@/lib/learn/types";

/*
 * Practice: every activity of the road's lessons in one place, run by the same components with the
 * same lesson data (no copies), followed by that lesson's own short questions. Two kinds stay in
 * their lessons only: a reflection (choosing the card that touched you is not something to
 * practise) and a checklist kept as a private list rather than a quiz.
 */

export type PracticeEntry = {
  /** `${lessonId}:${activityId}`: what the learner's best round and provisions are kept under. */
  key: string;
  lessonId: string;
  activityId: string;
  title: string;
  lesson: { number: string; title: string; href: `/${string}` };
  /** The lesson's drawing (content/art/scenes), served by /art. */
  drawing: string | null;
  href: `/${string}`;
  questions: number;
};

export type PracticeStation = { id: string; title: string; entries: PracticeEntry[] };

export type PracticeRound = { entry: PracticeEntry; activity: ActivityView; questions: QuestionView[] };

/** Why an activity stays in its lesson only, or null when it can be practised. */
export function leftOutBecause(activity: ActivityView): "reflection" | "privateChecklist" | null {
  if (activity.type === "reflection") return "reflection";
  if (activity.type === "checklist" && !activity.quiz) return "privateChecklist";
  return null;
}

/** The lesson's own short questions: its cards' checks and its quiz (not the situation, which is a scenario). */
function roundQuestions(lesson: Lesson, locale: Locale): QuestionView[] {
  return lessonQuestions(lesson, locale).filter((question) => question.id !== situationId(lesson.id));
}

async function context(locale: Locale) {
  const [khutuwat, sources, encyclopedia, visuals] = await Promise.all([loadKhutuwat(), loadSources(), loadFiqhEncyclopedia(), loadVisuals()]);
  const drawingOf = (lessonId: string) => visuals.find((visual) => visual.lesson === lessonId)?.scenes[0] ?? null;
  const roundsOf = async (lesson: Lesson): Promise<PracticeRound[]> => {
    const view = await toLessonView(lesson, khutuwat, locale, sources, encyclopedia);
    const questions = roundQuestions(lesson, locale);
    return view.activities
      .filter((activity) => leftOutBecause(activity) === null)
      .map((activity) => ({
        activity,
        questions,
        entry: {
          key: `${lesson.id}:${activity.id}`,
          lessonId: lesson.id,
          activityId: activity.id,
          title: activity.title,
          lesson: { number: lesson.id, title: view.title, href: lessonHref(lesson) },
          drawing: drawingOf(lesson.id),
          href: `/practice/${lesson.id}/${activity.id}`,
          questions: questions.length,
        },
      }));
  };
  return { khutuwat, roundsOf };
}

/** The practice index: the road's stations in order, each with the activities of its lessons. */
export async function practiceCatalogue(locale: Locale): Promise<PracticeStation[]> {
  const { khutuwat, roundsOf } = await context(locale);
  return Promise.all(
    khutuwat.road.map(async (station) => {
      const lessons = station.lessonIds.flatMap((id) => khutuwat.lessons.get(id) ?? []);
      const rounds = (await Promise.all(lessons.map(roundsOf))).flat();
      return { id: station.id, title: station.title[locale], entries: rounds.map((round) => round.entry) };
    }),
  );
}

export async function practiceRound(lessonId: string, activityId: string, locale: Locale): Promise<PracticeRound | null> {
  const { khutuwat, roundsOf } = await context(locale);
  const lesson = khutuwat.lessons.get(lessonId);
  const onRoad = khutuwat.road.some((station) => station.lessonIds.includes(lessonId));
  if (!lesson || !onRoad) return null;
  return (await roundsOf(lesson)).find((round) => round.entry.activityId === activityId) ?? null;
}

/** Every practice page, for static rendering. */
export async function practiceParams(): Promise<{ lesson: string; activity: string }[]> {
  const stations = await practiceCatalogue("ar");
  return stations.flatMap((station) => station.entries.map((entry) => ({ lesson: entry.lessonId, activity: entry.activityId })));
}
