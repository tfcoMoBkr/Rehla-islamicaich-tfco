import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LensView } from "@/components/lens/lens-view";
import type { LessonLink } from "@/components/rafiq/answer-view";
import { SectionHeading } from "@/components/ui/section-heading";
import { PageMessages } from "@/i18n/client-messages";
import { resolveLocale } from "@/i18n/locale";
import { loadKhutuwat } from "@/lib/content/load";
import { requireFeature } from "@/lib/require-feature";

// Rendered at build time; the photo is read in the browser and by the AI service, never here.
// See scripts/check-static.mjs.
export const dynamic = "error";

export async function generateMetadata({ params }: PageProps<"/[locale]/lens">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Lens" });
  return { title: t("title"), description: t("description") };
}

export default async function LensPage({ params }: PageProps<"/[locale]/lens">) {
  requireFeature("adasa");
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  const [t, khutuwat] = await Promise.all([getTranslations("Lens"), loadKhutuwat()]);
  const lessons: Record<string, LessonLink> = Object.fromEntries(
    [...khutuwat.lessons.values()].map((lesson) => [
      lesson.id,
      { title: lesson.title[locale], href: `/learn/${lesson.station}/${lesson.slug}` },
    ]),
  );

  return (
    <PageMessages page="lens">
      <div className="mx-auto max-w-3xl px-4 pt-20 pb-32 sm:px-6 md:pt-24">
        <SectionHeading as="h1" title={t("title")} description={t("description")} />
        <div className="mt-10">
          <LensView lessons={lessons} />
        </div>
      </div>
    </PageMessages>
  );
}
