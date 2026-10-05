import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { BackToRoad } from "@/components/learn/back-to-road";
import { ExamFlow } from "@/components/learn/station/exam-flow";
import { StationGate } from "@/components/learn/station/station-gate";
import { SectionHeading } from "@/components/ui/section-heading";
import { resolveLocale } from "@/i18n/locale";
import { PageMessages } from "@/i18n/client-messages";
import { afterExam, getStationContext, stationParams, stationQuestions, stationReviewPool, toRoadStations } from "@/lib/content/khutuwat";
import { requireFeature } from "@/lib/require-feature";

// Rendered at build time: a request-time API here fails the build instead of making the page
// dynamic (and slow to open). See scripts/check-static.mjs.
export const dynamic = "error";

export const dynamicParams = false;

export function generateStaticParams() {
  return stationParams();
}

type Props = PageProps<"/[locale]/learn/[station]/exam">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Exam" });
  return { title: t("title") };
}

export default async function ExamPage({ params }: Props) {
  requireFeature("learn");
  const { locale: value, station: stationId } = await params;
  const locale = resolveLocale(value);
  setRequestLocale(locale);

  const context = await getStationContext(stationId);
  if (!context) notFound();
  const tr = await getTranslations("Exam");
  const { station } = context;
  const title = station.title[locale];

  return (
    <PageMessages page="exam">
      <StationGate route={toRoadStations(context)} stationId={station.id} stationTitle={title}>
        <div className="mx-auto max-w-2xl px-4 pt-14 pb-32 sm:px-6 md:pt-20">
          <BackToRoad />
          <SectionHeading as="h1" eyebrow={title} title={tr("title")} className="mt-6" />
          <div className="mt-8">
            <ExamFlow
              stationId={station.id}
              stationTitle={title}
              questions={stationQuestions(context, "exam", locale)}
              reviewPool={stationReviewPool(context, locale)}
              nextHref={afterExam(context, station.id)}
            />
          </div>
        </div>
      </StationGate>
    </PageMessages>
  );
}
