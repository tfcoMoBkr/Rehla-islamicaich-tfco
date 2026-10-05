import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { FromLesson } from "@/components/practice/from-lesson";
import { PracticeRound } from "@/components/practice/practice-round";
import { ProvisionsBadge } from "@/components/practice/provisions-badge";
import { PageMessages } from "@/i18n/client-messages";
import { resolveLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { practiceParams, practiceRound } from "@/lib/learn/practice";
import { requireFeature } from "@/lib/require-feature";

// Rendered at build time: a request-time API here fails the build instead of making the page
// dynamic (and slow to open). See scripts/check-static.mjs.
export const dynamic = "error";

export const dynamicParams = false;

export function generateStaticParams() {
  return practiceParams();
}

type Props = PageProps<"/[locale]/practice/[lesson]/[activity]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: value, lesson, activity } = await params;
  const round = await practiceRound(lesson, activity, resolveLocale(value));
  return { title: round?.entry.title };
}

/** One activity in Practice: run full width, then the lesson's own short questions. */
export default async function PracticeRoundPage({ params }: Props) {
  requireFeature("practice");
  const { locale: value, lesson, activity } = await params;
  const locale = resolveLocale(value);
  setRequestLocale(locale);
  const [t, round] = await Promise.all([getTranslations("Practice"), practiceRound(lesson, activity, locale)]);
  if (!round) notFound();
  const { entry } = round;

  return (
    <PageMessages page="practiceRound">
      <div className="mx-auto max-w-3xl px-4 pt-14 pb-32 sm:px-6 md:pt-20">
        <Link href="/practice" className="inline-flex min-h-11 items-center font-medium text-muted-foreground underline underline-offset-4">
          {t("backToPractice")}
        </Link>
        <header className="mt-4 grid gap-3">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{entry.title}</h1>
          <FromLesson number={entry.lesson.number} title={entry.lesson.title} href={entry.lesson.href} />
          <ProvisionsBadge className="justify-self-start" />
        </header>
        <div className="mt-8">
          <PracticeRound entryKey={entry.key} lessonId={entry.lessonId} activity={round.activity} questions={round.questions} />
        </div>
      </div>
    </PageMessages>
  );
}
