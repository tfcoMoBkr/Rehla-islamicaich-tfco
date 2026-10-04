import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { BackToRoad } from "@/components/learn/back-to-road";
import { BaselineFlow } from "@/components/learn/station/baseline-flow";
import { StationGate } from "@/components/learn/station/station-gate";
import { SectionHeading } from "@/components/ui/section-heading";
import { resolveLocale } from "@/i18n/locale";
import { getStationContext, stationQuestions, toRoadStations } from "@/lib/content/khutuwat";
import { lessonHref } from "@/lib/content/lesson-view";
import { requireFeature } from "@/lib/require-feature";

type Props = PageProps<"/[locale]/learn/[station]/check">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Baseline" });
  return { title: t("title") };
}

export default async function BaselinePage({ params }: Props) {
  requireFeature("learn");
  const { locale: value, station: stationId } = await params;
  const locale = resolveLocale(value);
  setRequestLocale(locale);

  const context = await getStationContext(stationId);
  if (!context) notFound();
  const tr = await getTranslations("Baseline");
  const { station } = context;
  const title = station.title[locale];
  const firstLesson = context.khutuwat.lessons.get(station.lessonIds[0] ?? "");

  return (
    <StationGate route={toRoadStations(context)} stationId={station.id} stationTitle={title}>
      <div className="mx-auto max-w-2xl px-4 pt-14 pb-32 sm:px-6 md:pt-20">
        <BackToRoad />
        <SectionHeading as="h1" eyebrow={title} title={tr("title")} className="mt-6" />
        <div className="mt-8">
          <BaselineFlow
            stationId={station.id}
            stationTitle={title}
            questions={stationQuestions(context, "baseline", locale)}
            nextHref={firstLesson ? lessonHref(firstLesson) : "/learn"}
          />
        </div>
      </div>
    </StationGate>
  );
}
