import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AccountShell } from "@/components/account/account-shell";
import { NewPasswordForm } from "@/components/account/new-password-form";
import { PageMessages } from "@/i18n/client-messages";
import { resolveLocale } from "@/i18n/locale";
import { requireAccounts } from "@/lib/require-feature";

// Rendered at build time; the reset link's token is read in the browser. See scripts/check-static.mjs.
export const dynamic = "error";

export async function generateMetadata({ params }: PageProps<"/[locale]/account/new-password">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Account" });
  return { title: t("newPasswordTitle"), robots: { index: false } };
}

export default async function NewPasswordPage({ params }: PageProps<"/[locale]/account/new-password">) {
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  requireAccounts();
  const t = await getTranslations("Account");

  return (
    <PageMessages page="newPassword">
      <AccountShell title={t("newPasswordTitle")} description={t("newPasswordDescription")}>
        <NewPasswordForm />
      </AccountShell>
    </PageMessages>
  );
}
