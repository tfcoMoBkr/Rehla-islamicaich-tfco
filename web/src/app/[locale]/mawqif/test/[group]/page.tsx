import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { MawqifTest, type TestQuestion, type TestSituation } from "@/components/mawqif/mawqif-test";
import { SectionHeading } from "@/components/ui/section-heading";
import { PageMessages } from "@/i18n/client-messages";
import { resolveLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { loadKhutuwat, loadSituations } from "@/lib/content/load";
import { situationHref, testGroups, toSituationView } from "@/lib/content/situation-view";
import type { ItemView } from "@/lib/mawqif/types";
import { requireFeature } from "@/lib/require-feature";

// Rendered at build time, one page per test. See scripts/check-static.mjs.
export const dynamic = "error";

export function generateStaticParams() {
  return loadSituations().then((situations) =>
    routing.locales.flatMap((locale) => testGroups(situations).map((group) => ({ locale, group: group.id }))),
  );
}

async function findGroup(id: string) {
  const group = testGroups(await loadSituations()).find((candidate) => candidate.id === id);
  if (!group) notFound();
  return group;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/mawqif/test/[group]">): Promise<Metadata> {
  const { locale: raw, group: id } = await params;
  const locale = resolveLocale(raw);
  await findGroup(id);
  const t = await getTranslations({ locale, namespace: "Mawqif" });
  return { title: id === "all" ? t("testAll") : t("testAfter", { number: id }) };
}

export default async function MawqifTestPage({ params }: PageProps<"/[locale]/mawqif/test/[group]">) {
  requireFeature("mawqif");
  const { locale: raw, group: id } = await params;
  const locale = resolveLocale(raw);
  setRequestLocale(locale);
  const [t, situations, khutuwat] = await Promise.all([getTranslations("Mawqif"), loadSituations(), loadKhutuwat()]);
  const group = await findGroup(id);
  const views = await Promise.all(
    situations.filter((situation) => group.situations.includes(situation.id)).map((situation) => toSituationView(situation, khutuwat, locale)),
  );

  // Mixed: the first question of each situation, then the second of each, and so on.
  const rounds = Math.max(...views.map((view) => view.check.length));
  const questions: TestQuestion[] = Array.from({ length: rounds }, (_, round) =>
    views.flatMap((view) => (view.check[round] ? [{ situation: view.id, check: view.check[round] }] : [])),
  ).flat();
  const items = [...new Map(views.flatMap((view) => view.items).map((item): [string, ItemView] => [item.id, item])).values()];
  const testSituations: TestSituation[] = views.map((view) => ({ id: view.id, title: view.title, href: situationHref(view.id), related: view.related }));

  return (
    <PageMessages page="mawqifTest">
      <div className="mx-auto max-w-3xl px-4 pt-16 pb-32 sm:px-6 md:pt-20">
        <Link href="/mawqif" className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground underline underline-offset-4">
          {t("backToMap")}
        </Link>
        <SectionHeading
          as="h1"
          title={id === "all" ? t("testAll") : t("testAfter", { number: id })}
          description={t("testIntro", { count: questions.length })}
          className="mt-4"
        />
        <div className="mt-8">
          <MawqifTest group={group.id} questions={questions} situations={testSituations} items={items} />
        </div>
      </div>
    </PageMessages>
  );
}
