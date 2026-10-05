import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Quiet } from "@/components/community/community-states";
import { ReviewList } from "@/components/community/review-list";
import { SectionHeading } from "@/components/ui/section-heading";
import { accountsEnabled } from "@/config/accounts";
import { PageMessages } from "@/i18n/client-messages";
import { resolveLocale } from "@/i18n/locale";
import { requireFeature } from "@/lib/require-feature";

// Rendered at build time; the database lets only moderators read what is here.
export const dynamic = "error";

export async function generateMetadata({ params }: PageProps<"/[locale]/community/review">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Community" });
  return { title: t("moderation.title"), robots: { index: false } };
}

export default async function CommunityReviewPage({ params }: PageProps<"/[locale]/community/review">) {
  requireFeature("community");
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations("Community");

  return (
    <PageMessages page="communityReview">
      <div className="mx-auto max-w-3xl px-4 pt-20 pb-32 sm:px-6 md:pt-24">
        <SectionHeading as="h1" title={t("moderation.title")} description={t("moderation.description")} />
        <div className="mt-8">{accountsEnabled() ? <ReviewList /> : <Quiet title={t("unavailable.title")} body={t("unavailable.body")} />}</div>
      </div>
    </PageMessages>
  );
}
