import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AiNotice } from "@/components/rafiq/ai-notice";
import type { LessonLink } from "@/components/rafiq/answer-view";
import { RafiqConversation } from "@/components/rafiq/rafiq-conversation";
import { SectionHeading } from "@/components/ui/section-heading";
import { resolveLocale } from "@/i18n/locale";
import { loadKhutuwat } from "@/lib/content/load";
import { requireFeature } from "@/lib/require-feature";

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

  return (
    <div className="mx-auto max-w-3xl px-4 pt-20 pb-32 sm:px-6 md:pt-24">
      <SectionHeading as="h1" title={t("title")} description={t("description")} />
      <AiNotice figure={false} className="mt-6" />
      <div className="mt-10">
        <RafiqConversation lessons={lessons} />
      </div>
    </div>
  );
}
