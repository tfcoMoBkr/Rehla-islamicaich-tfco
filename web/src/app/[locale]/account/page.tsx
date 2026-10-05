import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AccountShell } from "@/components/account/account-shell";
import { AccountView } from "@/components/account/account-view";
import { PageMessages } from "@/i18n/client-messages";
import { resolveLocale } from "@/i18n/locale";
import { requireAccounts } from "@/lib/require-feature";

// Rendered at build time: the account itself is read in the browser, with the session kept there.
// See scripts/check-static.mjs.
export const dynamic = "error";

export async function generateMetadata({ params }: PageProps<"/[locale]/account">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Account" });
  return { title: t("accountTitle"), description: t("accountDescription"), robots: { index: false } };
}

export default async function AccountPage({ params }: PageProps<"/[locale]/account">) {
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  requireAccounts();
  const t = await getTranslations("Account");

  return (
    <PageMessages page="account">
      <AccountShell title={t("accountTitle")} description={t("accountDescription")} card={false}>
        <AccountView />
      </AccountShell>
    </PageMessages>
  );
}
