import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AccountShell } from "@/components/account/account-shell";
import { SignInForm } from "@/components/account/sign-in-form";
import { PageMessages } from "@/i18n/client-messages";
import { resolveLocale } from "@/i18n/locale";
import { requireAccounts } from "@/lib/require-feature";

// Rendered at build time. See scripts/check-static.mjs.
export const dynamic = "error";

export async function generateMetadata({ params }: PageProps<"/[locale]/account/sign-in">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Account" });
  return { title: t("signIn"), description: t("signInDescription") };
}

export default async function SignInPage({ params }: PageProps<"/[locale]/account/sign-in">) {
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  requireAccounts();
  const t = await getTranslations("Account");

  return (
    <PageMessages page="signIn">
      <AccountShell title={t("signIn")} description={t("signInDescription")}>
        <SignInForm />
      </AccountShell>
    </PageMessages>
  );
}
