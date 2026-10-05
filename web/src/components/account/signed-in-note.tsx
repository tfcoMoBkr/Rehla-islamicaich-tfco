"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { AccountSummary } from "@/lib/account/session";

/** Shown instead of a sign-in or sign-up form to someone already signed in. */
export function SignedInNote({ account }: { account: AccountSummary }) {
  const t = useTranslations("Account");
  return (
    <div className="grid gap-4">
      <p className="text-lg">{t("signedInAs", { name: account.name })}</p>
      <Button asChild className="justify-self-start">
        <Link href="/account">{t("toAccount")}</Link>
      </Button>
    </div>
  );
}
