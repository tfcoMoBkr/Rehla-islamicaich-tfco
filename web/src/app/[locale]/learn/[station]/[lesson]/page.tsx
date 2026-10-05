import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { LessonPlayer } from "@/components/learn/lesson/lesson-player";
import { StationGate } from "@/components/learn/station/station-gate";
import { resolveLocale } from "@/i18n/locale";
import { PageMessages } from "@/i18n/client-messages";
import { earlierQuestions, findLesson, getStationContext, lessonParams, nextAfterLesson, toRoadStations } from "@/lib/content/khutuwat";
import { toLessonView } from "@/lib/content/lesson-view";
import { loadFiqhEncyclopedia, loadSources } from "@/lib/content/load";
import { toVisualView } from "@/lib/content/visual-view";
import { requireFeature } from "@/lib/require-feature";

// Rendered at build time: a request-time API here fails the build instead of making the page
// dynamic (and slow to open). See scripts/check-static.mjs.
export const dynamic = "error";

export const dynamicParams = false;

export function generateStaticParams() {
  return lessonParams();
}

type Props = PageProps<"/[locale]/learn/[station]/[lesson]">;

/** The lesson segment of the URL is the lesson's slug. */
async function lessonFor(stationId: string, slug: string) {
  const context = await getStationContext(stationId);
  const lesson = context ? findLesson(context, slug) : undefined;
  if (!context || !lesson) notFound();
  return { context, lesson };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: value, station, lesson: slug } = await params;
  const locale = resolveLocale(value);
  const { lesson } = await lessonFor(station, slug);
  return { title: lesson.title[locale] };
}

export default async function LessonPage({ params }: Props) {
  requireFeature("learn");
  const { locale: value, station: stationId, lesson: slug } = await params;
  const locale = resolveLocale(value);
  setRequestLocale(locale);

  const { context, lesson } = await lessonFor(stationId, slug);
  const [lessonView, visual] = await Promise.all([
    toLessonView(lesson, context.khutuwat, locale, await loadSources(), await loadFiqhEncyclopedia()),
    toVisualView(lesson.id),
  ]);

  return (
    <PageMessages page="lesson">
      <StationGate route={toRoadStations(context)} stationId={stationId} stationTitle={context.station.title[locale]}>
        <LessonPlayer
          lesson={lessonView}
          visual={visual}
          provisionsPool={earlierQuestions(context, lesson.id, locale)}
          next={nextAfterLesson(context, lesson.id)}
        />
      </StationGate>
    </PageMessages>
  );
}
