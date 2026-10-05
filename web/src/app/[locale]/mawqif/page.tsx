import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { MawqifMap } from "@/components/mawqif/mawqif-map";
import { ProvisionsBadge } from "@/components/practice/provisions-badge";
import { SectionHeading } from "@/components/ui/section-heading";
import { PageMessages } from "@/i18n/client-messages";
import { resolveLocale } from "@/i18n/locale";
import { loadSituations } from "@/lib/content/load";
import { situationStop, testGroups } from "@/lib/content/situation-view";
import { requireFeature } from "@/lib/require-feature";

// Rendered at build time; progress is read on the device. See scripts/check-static.mjs.
export const dynamic = "error";

export async function generateMetadata({ params }: PageProps<"/[locale]/mawqif">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Mawqif" });
  return { title: t("title"), description: t("description") };
}

/** Everyday situations as stops on the road, with a test after every few. */
export default async function MawqifPage({ params }: PageProps<"/[locale]/mawqif">) {
  requireFeature("mawqif");
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  const [t, situations] = await Promise.all([getTranslations("Mawqif"), loadSituations()]);

  return (
    <PageMessages page="mawqif">
      <div className="mx-auto max-w-3xl px-4 pt-20 pb-32 sm:px-6 md:pt-24">
        <SectionHeading as="h1" title={t("title")} description={t("description")} />
        <div className="mt-6 grid gap-2">
          <ProvisionsBadge className="justify-self-start" />
          <p className="text-sm text-muted-foreground">{t("howItWorks")}</p>
        </div>
        <div className="mt-10">
          <MawqifMap stops={situations.map((situation) => situationStop(situation, locale))} tests={testGroups(situations)} />
        </div>
      </div>
    </PageMessages>
  );
}
