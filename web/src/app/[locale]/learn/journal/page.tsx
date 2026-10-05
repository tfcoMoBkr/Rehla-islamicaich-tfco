import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { BackToRoad } from "@/components/learn/back-to-road";
import { JournalView } from "@/components/learn/journal/journal-view";
import { SectionHeading } from "@/components/ui/section-heading";
import { resolveLocale } from "@/i18n/locale";
import { ProvisionsBadge } from "@/components/practice/provisions-badge";
import { features } from "@/config/features";
import { PageMessages } from "@/i18n/client-messages";
import { lessonText } from "@/lib/content/lesson-view";
import { loadKhutuwat } from "@/lib/content/load";
import { requireFeature } from "@/lib/require-feature";

// Rendered at build time: a request-time API here fails the build instead of making the page
// dynamic (and slow to open). See scripts/check-static.mjs.
export const dynamic = "error";

export async function generateMetadata({ params }: PageProps<"/[locale]/learn/journal">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Journal" });
  return { title: t("title") };
}

export default async function JournalPage({ params }: PageProps<"/[locale]/learn/journal">) {
  requireFeature("learn");
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  const [tr, khutuwat] = await Promise.all([getTranslations("Journal"), loadKhutuwat()]);
  const lessons = [...khutuwat.lessons.values()];
  // A reflection keeps one of the lesson's cards in the journal.
  const pickable = Object.fromEntries(
    lessons
      .filter((lesson) => lesson.activities.some((activity) => activity.type === "reflection"))
      .map((lesson) => [
        lesson.id,
        Object.fromEntries(lesson.cards.flatMap((card) => {
          const text = lessonText(card, locale);
          return text ? [[card.id, text]] : [];
        })),
      ]),
  );

  return (
    <PageMessages page="journal">
      <div className="mx-auto max-w-4xl px-4 pt-14 pb-32 sm:px-6 md:pt-20">
        <BackToRoad />
        <SectionHeading as="h1" title={tr("title")} description={tr("description")} className="mt-6" />
        {features.practice && <ProvisionsBadge className="mt-6" />}
        <div className="mt-10">
          <JournalView
            lessons={lessons.map((lesson) => ({
              id: lesson.id,
              number: lesson.status === "demo" ? "" : lesson.id,
              title: lesson.title[locale],
              stationId: lesson.station,
            }))}
            stations={[...khutuwat.road, ...khutuwat.practice].map((station) => ({
              id: station.id,
              title: station.title[locale],
            }))}
            pickable={pickable}
          />
        </div>
      </div>
    </PageMessages>
  );
}
