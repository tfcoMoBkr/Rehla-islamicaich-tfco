import "server-only";

import type { Locale } from "next-intl";

import { lessonQuestions, toLessonView } from "@/lib/content/lesson-view";
import { loadFiqhEncyclopedia, loadKhutuwat, loadSources } from "@/lib/content/load";
import type { ActivityView, QuestionView } from "@/lib/learn/types";

/**
 * The real things the Khutuwat tour shows in miniature: the stations, one board line with its
 * source, the shortest ordering activity of the road (to try once), and one of the lessons' own
 * short questions. All of it comes from the lesson files as they are.
 */
export type TourSample = {
  stations: { id: string; title: string }[];
  line: { text: string; source: string } | null;
  activity: { activity: ActivityView; seed: string; lesson: string } | null;
  question: QuestionView | null;
};

const BOARD = { lesson: "2.4", card: "c3" } as const;

export async function tourSample(locale: Locale): Promise<TourSample> {
  const [khutuwat, sources, encyclopedia] = await Promise.all([loadKhutuwat(), loadSources(), loadFiqhEncyclopedia()]);
  const road = khutuwat.road.flatMap((station) => station.lessonIds.flatMap((id) => khutuwat.lessons.get(id) ?? []));
  const views = await Promise.all(road.map(async (lesson) => ({ lesson, view: await toLessonView(lesson, khutuwat, locale, sources, encyclopedia) })));

  const board = views.find(({ lesson }) => lesson.id === BOARD.lesson)?.view.cards.find((card) => card.id === BOARD.card);
  const ordering = views
    .flatMap(({ lesson, view }) =>
      view.activities.flatMap((activity) => (activity.type === "order" ? [{ activity, seed: `tour:${lesson.id}:${activity.id}`, lesson: view.title }] : [])),
    )
    .sort((a, b) => (a.activity.type === "order" && b.activity.type === "order" ? a.activity.items.length - b.activity.items.length : 0));

  return {
    stations: khutuwat.road.map((station) => ({ id: station.id, title: station.title[locale] })),
    line: board?.text && board.sources[0] ? { text: board.text, source: board.sources[0].title } : null,
    activity: ordering[0] ?? null,
    question: road.flatMap((lesson) => lessonQuestions(lesson, locale)).find((question) => question.type === "single" || question.type === "trueFalse") ?? null,
  };
}
