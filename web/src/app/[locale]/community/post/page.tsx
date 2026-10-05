import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Quiet } from "@/components/community/community-states";
import { ThreadView } from "@/components/community/thread-view";
import { accountsEnabled } from "@/config/accounts";
import { PageMessages } from "@/i18n/client-messages";
import { resolveLocale } from "@/i18n/locale";
import { requireFeature } from "@/lib/require-feature";

// Rendered at build time; the post named in the address (?id=) is read in the browser.
export const dynamic = "error";

export async function generateMetadata({ params }: PageProps<"/[locale]/community/post">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Community" });
  return { title: t("title"), robots: { index: false } };
}

export default async function CommunityPostPage({ params }: PageProps<"/[locale]/community/post">) {
  requireFeature("community");
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations("Community");

  return (
    <PageMessages page="communityPost">
      <div className="mx-auto max-w-3xl px-4 pt-20 pb-32 sm:px-6 md:pt-24">
        {accountsEnabled() ? <ThreadView /> : <Quiet title={t("unavailable.title")} body={t("unavailable.body")} />}
      </div>
    </PageMessages>
  );
}
