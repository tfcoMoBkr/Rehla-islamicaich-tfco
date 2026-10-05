import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CalmLine, Quiet } from "@/components/community/community-states";
import { PostComposer } from "@/components/community/post-composer";
import { SectionHeading } from "@/components/ui/section-heading";
import { accountsEnabled } from "@/config/accounts";
import { PageMessages } from "@/i18n/client-messages";
import { resolveLocale } from "@/i18n/locale";
import { requireFeature } from "@/lib/require-feature";

// Rendered at build time; membership is read in the browser.
export const dynamic = "error";

export async function generateMetadata({ params }: PageProps<"/[locale]/community/write">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Community" });
  return { title: t("composer.title"), robots: { index: false } };
}

export default async function CommunityWritePage({ params }: PageProps<"/[locale]/community/write">) {
  requireFeature("community");
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations("Community");

  return (
    <PageMessages page="communityWrite">
      <div className="mx-auto max-w-3xl px-4 pt-20 pb-32 sm:px-6 md:pt-24">
        <SectionHeading as="h1" title={t("composer.title")} description={t("composer.description")} />
        <div className="mt-8 grid gap-8">
          {accountsEnabled() ? (
            <>
              <CalmLine />
              <PostComposer />
            </>
          ) : (
            <Quiet title={t("unavailable.title")} body={t("unavailable.body")} />
          )}
        </div>
      </div>
    </PageMessages>
  );
}
