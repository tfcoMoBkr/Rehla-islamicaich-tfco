import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AwaitingReviewBadge } from "@/components/learn/content-badges";
import { LearnRoad } from "@/components/learn/road/learn-road";
import { SectionHeading } from "@/components/ui/section-heading";
import { resolveLocale } from "@/i18n/locale";
import { loadKhutuwat } from "@/lib/content/load";
import { toStationView } from "@/lib/content/lesson-view";
import { showDrafts } from "@/lib/content/visibility";
import { requireFeature } from "@/lib/require-feature";

export async function generateMetadata({ params }: PageProps<"/[locale]/learn">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Learn" });
  return { title: t("title"), description: t("description") };
}

export default async function LearnPage({ params }: PageProps<"/[locale]/learn">) {
  requireFeature("learn");
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  const [t, khutuwat] = await Promise.all([getTranslations("Learn"), loadKhutuwat()]);

  const road = khutuwat.road.map((station) => toStationView(station, khutuwat.lessons, locale));
  const practice = khutuwat.practice.map((station) => toStationView(station, khutuwat.lessons, locale));

  return (
    <div className="mx-auto max-w-5xl px-4 pt-20 pb-32 sm:px-6 md:pt-24">
      <SectionHeading as="h1" title={t("title")} description={t("description")} />
      {showDrafts() && (
        <p role="note" className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <AwaitingReviewBadge />
          {t("draftPreview")}
        </p>
      )}
      <div className="mt-10">
        <LearnRoad road={road} practice={practice} />
      </div>
    </div>
  );
}
