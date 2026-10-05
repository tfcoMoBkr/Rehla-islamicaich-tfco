import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CommunityHome } from "@/components/community/community-home";
import { CalmLine, Quiet, RulesList } from "@/components/community/community-states";
import { SectionHeading } from "@/components/ui/section-heading";
import { accountsEnabled } from "@/config/accounts";
import { PageMessages } from "@/i18n/client-messages";
import { resolveLocale } from "@/i18n/locale";
import { requireFeature } from "@/lib/require-feature";

// Rendered at build time; the posts are read in the browser. See scripts/check-static.mjs.
export const dynamic = "error";

export async function generateMetadata({ params }: PageProps<"/[locale]/community">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Community" });
  return { title: t("title"), description: t("description") };
}

/** Rehla Community: open to read for everyone; writing is for members who chose to join. */
export default async function CommunityPage({ params }: PageProps<"/[locale]/community">) {
  requireFeature("community");
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations("Community");

  return (
    <PageMessages page="community">
      <div className="mx-auto max-w-5xl px-4 pt-20 pb-32 sm:px-6 md:pt-24">
        <SectionHeading as="h1" title={t("title")} description={t("description")} />
        {accountsEnabled() ? (
          <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <aside aria-labelledby="community-rules" className="grid gap-4 lg:sticky lg:top-24 lg:order-last">
              <CalmLine />
              <div className="grid gap-3 rounded-2xl border border-hairline bg-card p-5">
                <h2 id="community-rules" className="font-display text-xl font-semibold">
                  {t("rules.title")}
                </h2>
                <RulesList className="text-sm" />
              </div>
            </aside>
            <CommunityHome />
          </div>
        ) : (
          <div className="mt-8">
            <Quiet title={t("unavailable.title")} body={t("unavailable.body")} />
          </div>
        )}
      </div>
    </PageMessages>
  );
}
