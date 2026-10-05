import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SituationPlayer } from "@/components/mawqif/situation-player";
import { SectionHeading } from "@/components/ui/section-heading";
import { PageMessages } from "@/i18n/client-messages";
import { resolveLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { loadKhutuwat, loadSituations } from "@/lib/content/load";
import { situationHref, toSituationView } from "@/lib/content/situation-view";
import { requireFeature } from "@/lib/require-feature";

// Rendered at build time, one page per situation. See scripts/check-static.mjs.
export const dynamic = "error";

export function generateStaticParams() {
  return loadSituations().then((situations) =>
    routing.locales.flatMap((locale) => situations.map((situation) => ({ locale, situation: situation.id }))),
  );
}

async function find(id: string) {
  const situation = (await loadSituations()).find((candidate) => candidate.id === id);
  if (!situation) notFound();
  return situation;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/mawqif/[situation]">): Promise<Metadata> {
  const { locale: raw, situation: id } = await params;
  const locale = resolveLocale(raw);
  const situation = await find(id);
  const t = await getTranslations({ locale, namespace: "Mawqif" });
  return { title: `${situation.title[locale]} · ${t("title")}`, description: situation.scene[locale] };
}

export default async function SituationPage({ params }: PageProps<"/[locale]/mawqif/[situation]">) {
  requireFeature("mawqif");
  const { locale: raw, situation: id } = await params;
  const locale = resolveLocale(raw);
  setRequestLocale(locale);
  const [t, situations, khutuwat] = await Promise.all([getTranslations("Mawqif"), loadSituations(), loadKhutuwat()]);
  const situation = await find(id);
  const view = await toSituationView(situation, khutuwat, locale);
  const following = situations[situations.indexOf(situation) + 1];

  return (
    <PageMessages page="situation">
      <div className="mx-auto max-w-3xl px-4 pt-16 pb-32 sm:px-6 md:pt-20">
        <Link href="/mawqif" className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground underline underline-offset-4">
          {t("backToMap")}
        </Link>
        <SectionHeading as="h1" eyebrow={t("stopLabel", { number: situation.order })} title={view.title} className="mt-4" />
        <div className="mt-8">
          <SituationPlayer
            situation={view}
            next={following ? { href: situationHref(following.id), title: following.title[locale] } : null}
          />
        </div>
      </div>
    </PageMessages>
  );
}
