import { Camera, HardDrive, MessageCircle, ShieldCheck, Trash2, UserRound, Users, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { accountsEnabled } from "@/config/accounts";
import { features } from "@/config/features";
import { PageMessages } from "@/i18n/client-messages";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/locale";

// Rendered at build time. See scripts/check-static.mjs.
export const dynamic = "error";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Privacy" });
  return { title: t("title"), description: t("description") };
}

function Part({ id, icon: Icon, title, children }: { id: string; icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-3 border-t border-hairline pt-8">
      <h2 id={id} className="flex items-center gap-3 font-display text-2xl font-semibold">
        <Icon aria-hidden className="size-6 shrink-0 text-oasis-text" />
        {title}
      </h2>
      {children}
    </section>
  );
}

/** What Rehla keeps and where, for guests and (when accounts are on) for account holders. docs/PRIVACY.md says the same. */
export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations("Privacy");
  const accounts = accountsEnabled();

  return (
    <PageMessages page="privacy">
      <div className="mx-auto grid max-w-3xl gap-10 px-4 pt-20 pb-32 sm:px-6 md:pt-24">
        <SectionHeading as="h1" title={t("title")} description={t("description")} />

        <Part id="privacy-guest" icon={HardDrive} title={t("guestTitle")}>
          <p>{t("guestBody")}</p>
        </Part>

        {accounts && (
          <Part id="privacy-account" icon={UserRound} title={t("accountTitle")}>
            <p>{t("accountIntro")}</p>
            <h3 className="mt-2 font-semibold">{t("keptTitle")}</h3>
            <ul className="grid list-inside list-disc gap-2 marker:text-oasis">
              <li>{t("keptEmail")}</li>
              <li>{t("keptName")}</li>
              <li>{t("keptCountry")}</li>
              <li>{t("keptLocale")}</li>
              <li>{t("keptProgress")}</li>
            </ul>
          </Part>
        )}

        <Part id="privacy-never" icon={ShieldCheck} title={t("neverTitle")}>
          <p>{t("neverBody")}</p>
        </Part>

        {accounts && (
          <Part id="privacy-where" icon={HardDrive} title={t("whereTitle")}>
            <p>{t("whereAccount")}</p>
            <p>{t("whereDevice")}</p>
          </Part>
        )}

        <Part id="privacy-rafiq" icon={MessageCircle} title={t("rafiqTitle")}>
          <p>{t("rafiqBody")}</p>
          <p>{t("nameBody")}</p>
        </Part>

        {features.mawqif && (
          <Part id="privacy-mawqif" icon={MessageCircle} title={t("mawqifTitle")}>
            <p>{t("mawqifBody")}</p>
          </Part>
        )}

        {features.adasa && (
          <Part id="privacy-lens" icon={Camera} title={t("lensTitle")}>
            <p>{t("lensBody")}</p>
          </Part>
        )}

        {features.community && accounts && (
          <Part id="privacy-community" icon={Users} title={t("communityTitle")}>
            <p>{t("communityBody")}</p>
            <p>{t("communityChecks")}</p>
            <p>{t("communityLeave")}</p>
          </Part>
        )}

        <Part id="privacy-control" icon={Trash2} title={t("controlTitle")}>
          {accounts && <p>{t("controlAccount")}</p>}
          <p>{t("controlGuest")}</p>
          {accounts && (
            <div className="mt-2 flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href="/account">{t("toAccount")}</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/account/sign-up">{t("toSignUp")}</Link>
              </Button>
            </div>
          )}
        </Part>
      </div>
    </PageMessages>
  );
}
