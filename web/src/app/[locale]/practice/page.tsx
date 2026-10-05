import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { FromLesson } from "@/components/practice/from-lesson";
import { PracticeCardStatus } from "@/components/practice/practice-card-status";
import { ProvisionsBadge } from "@/components/practice/provisions-badge";
import { SectionHeading } from "@/components/ui/section-heading";
import { PageMessages } from "@/i18n/client-messages";
import { resolveLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { practiceCatalogue } from "@/lib/learn/practice";
import { requireFeature } from "@/lib/require-feature";

// Rendered at build time: a request-time API here fails the build instead of making the page
// dynamic (and slow to open). See scripts/check-static.mjs.
export const dynamic = "error";

export async function generateMetadata({ params }: PageProps<"/[locale]/practice">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Practice" });
  return { title: t("title"), description: t("description") };
}

/** Every activity of the road, gathered by station, to play outside the lesson flow. */
export default async function PracticePage({ params }: PageProps<"/[locale]/practice">) {
  requireFeature("practice");
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  const [t, stations] = await Promise.all([getTranslations("Practice"), practiceCatalogue(locale)]);

  return (
    <PageMessages page="practice">
      <div className="mx-auto max-w-5xl px-4 pt-20 pb-32 sm:px-6 md:pt-24">
        <SectionHeading as="h1" title={t("title")} description={t("description")} />
        <div className="mt-6 grid gap-2">
          <ProvisionsBadge className="justify-self-start" />
          <p className="text-sm text-muted-foreground">{t("howPoints")}</p>
        </div>

        {stations.map((station) => (
          <section key={station.id} aria-labelledby={`practice-station-${station.id}`} className="mt-14">
            <h2 id={`practice-station-${station.id}`} className="font-display text-2xl font-semibold">
              {station.title}
            </h2>
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {station.entries.map((entry) => (
                <li key={entry.key}>
                  <article
                    aria-labelledby={`practice-${entry.key}`}
                    className="grid h-full content-start gap-3 rounded-3xl border border-hairline bg-paper p-5"
                  >
                    {entry.drawing && (
                      // eslint-disable-next-line @next/next/no-img-element -- an inert SVG drawing served by /art; nothing to optimise
                      <img
                        src={`/art/scenes/${entry.drawing}.svg`}
                        alt=""
                        width={320}
                        height={180}
                        loading="lazy"
                        className="aspect-video w-full rounded-2xl bg-sand object-cover"
                      />
                    )}
                    <h3 id={`practice-${entry.key}`} className="font-display text-xl font-semibold">
                      {entry.title}
                    </h3>
                    <FromLesson number={entry.lesson.number} title={entry.lesson.title} href={entry.lesson.href} />
                    <PracticeCardStatus entryKey={entry.key} lessonId={entry.lessonId} />
                    <Link
                      href={entry.href}
                      className="mt-1 inline-flex min-h-11 items-center gap-2 justify-self-start rounded-full bg-primary px-5 font-semibold text-primary-foreground"
                    >
                      {t("open")}
                      <span className="sr-only">: {entry.title}</span>
                      <ArrowRight aria-hidden className="size-4 rtl:-scale-x-100" />
                    </Link>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PageMessages>
  );
}
