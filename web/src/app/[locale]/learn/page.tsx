import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LearnRoad } from "@/components/learn/road/learn-road";
import { SectionHeading } from "@/components/ui/section-heading";
import { resolveLocale } from "@/i18n/locale";
import { TourHost } from "@/components/guide/guide-host";
import { GuideReplay } from "@/components/guide/guide-replay";
import { PageMessages } from "@/i18n/client-messages";
import { tourSample } from "@/lib/learn/tour";
import { loadKhutuwat } from "@/lib/content/load";
import { toStationView } from "@/lib/content/lesson-view";
import { requireFeature } from "@/lib/require-feature";

// Rendered at build time: a request-time API here fails the build instead of making the page
// dynamic (and slow to open). See scripts/check-static.mjs.
export const dynamic = "error";

export async function generateMetadata({ params }: PageProps<"/[locale]/learn">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Learn" });
  return { title: t("title"), description: t("description") };
}

export default async function LearnPage({ params }: PageProps<"/[locale]/learn">) {
  requireFeature("learn");
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  const [t, khutuwat, sample] = await Promise.all([getTranslations("Learn"), loadKhutuwat(), tourSample(locale)]);

  const road = khutuwat.road.map((station) => toStationView(station, khutuwat.lessons, locale));
  const practice = khutuwat.practice.map((station) => toStationView(station, khutuwat.lessons, locale));

  return (
    <PageMessages page="learn">
      <div className="mx-auto max-w-5xl px-4 pt-20 pb-32 sm:px-6 md:pt-24">
        <SectionHeading as="h1" title={t("title")} description={t("description")} />
        <GuideReplay className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4" />
        <div className="mt-8">
          <LearnRoad road={road} practice={practice} />
        </div>
      </div>
      <TourHost sample={sample} />
    </PageMessages>
  );
}
