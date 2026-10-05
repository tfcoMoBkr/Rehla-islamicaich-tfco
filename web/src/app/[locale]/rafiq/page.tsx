import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AiNotice } from "@/components/rafiq/ai-notice";
import type { LessonLink } from "@/components/rafiq/answer-view";
import { RafiqConversation } from "@/components/rafiq/rafiq-conversation";
import { WhoIsRafiq } from "@/components/rafiq/who-is-rafiq";
import type { RoadLesson } from "@/components/rafiq/rafiq-memory";
import { SectionHeading } from "@/components/ui/section-heading";
import { resolveLocale } from "@/i18n/locale";
import { PageMessages } from "@/i18n/client-messages";
import { loadKhutuwat } from "@/lib/content/load";
import { requireFeature } from "@/lib/require-feature";

// Rendered at build time: a request-time API here fails the build instead of making the page
// dynamic (and slow to open). See scripts/check-static.mjs.
export const dynamic = "error";

export async function generateMetadata({ params }: PageProps<"/[locale]/rafiq">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Rafiq" });
  return { title: t("title"), description: t("description") };
}

export default async function RafiqPage({ params }: PageProps<"/[locale]/rafiq">) {
  requireFeature("rafiq");
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  const [t, khutuwat] = await Promise.all([getTranslations("Rafiq"), loadKhutuwat()]);

  const lessons: Record<string, LessonLink> = Object.fromEntries(
    [...khutuwat.lessons.values()].map((lesson) => [
      lesson.id,
      { title: lesson.title[locale], href: `/learn/${lesson.station}/${lesson.slug}` },
    ]),
  );

  const road: RoadLesson[] = khutuwat.road.flatMap((station) =>
    station.lessonIds.flatMap((id) => (lessons[id] ? [{ id, ...lessons[id] }] : [])),
  );

  return (
    <PageMessages page="rafiq">
      <div className="mx-auto max-w-3xl px-4 pt-20 pb-32 sm:px-6 md:pt-24">
        <SectionHeading as="h1" title={t("title")} description={t("description")} />
        <div className="mt-6 grid gap-2">
          <AiNotice figure={false} />
          <WhoIsRafiq className="inline-flex min-h-11 items-center justify-self-start font-semibold text-primary underline underline-offset-4" />
        </div>
        <div className="mt-10">
          <RafiqConversation lessons={lessons} road={road} />
        </div>
      </div>
    </PageMessages>
  );
}
