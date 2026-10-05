import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AccountShell } from "@/components/account/account-shell";
import { SignUpForm } from "@/components/account/sign-up-form";
import { PageMessages } from "@/i18n/client-messages";
import { resolveLocale } from "@/i18n/locale";
import { requireAccounts } from "@/lib/require-feature";

// Rendered at build time. See scripts/check-static.mjs.
export const dynamic = "error";

export async function generateMetadata({ params }: PageProps<"/[locale]/account/sign-up">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Account" });
  return { title: t("create"), description: t("optional") };
}

export default async function SignUpPage({ params }: PageProps<"/[locale]/account/sign-up">) {
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  requireAccounts();
  const t = await getTranslations("Account");

  return (
    <PageMessages page="signUp">
      <AccountShell title={t("create")} description={t("optional")}>
        <SignUpForm />
      </AccountShell>
    </PageMessages>
  );
}
