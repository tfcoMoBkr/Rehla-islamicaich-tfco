import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AccountShell } from "@/components/account/account-shell";
import { ResetForm } from "@/components/account/reset-form";
import { passwordResetEnabled } from "@/config/accounts";
import { PageMessages } from "@/i18n/client-messages";
import { resolveLocale } from "@/i18n/locale";
import { requireAccounts } from "@/lib/require-feature";

// Rendered at build time. See scripts/check-static.mjs.
export const dynamic = "error";

export async function generateMetadata({ params }: PageProps<"/[locale]/account/reset">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Account" });
  return { title: t("resetTitle"), description: t("resetDescription"), robots: { index: false } };
}

export default async function ResetPage({ params }: PageProps<"/[locale]/account/reset">) {
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  requireAccounts();
  const t = await getTranslations("Account");
  const available = passwordResetEnabled();

  return (
    <PageMessages page="passwordReset">
      <AccountShell title={t("resetTitle")} description={available ? t("resetDescription") : undefined}>
        <ResetForm available={available} />
      </AccountShell>
    </PageMessages>
  );
}
