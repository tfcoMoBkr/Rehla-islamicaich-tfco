"use client";

import { UserRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { accountsEnabled } from "@/config/accounts";
import { Link, usePathname } from "@/i18n/navigation";
import { useAccount } from "@/lib/account/session";
import { cn } from "@/lib/utils";

/** The header's quiet way in: "Sign in", or the display name once signed in. Hidden when accounts are off. */
export function AccountEntry({ className }: { className?: string }) {
  const t = useTranslations("AccountEntry");
  const account = useAccount();
  const pathname = usePathname();
  if (!accountsEnabled()) return null;

  const href = account ? "/account" : "/account/sign-in";
  return (
    <Link
      href={href}
      aria-current={pathname === href ? "page" : undefined}
      aria-label={account ? t("label", { name: account.name }) : undefined}
      className={cn(
        "inline-flex min-h-11 max-w-40 items-center gap-2 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:max-w-56",
        className,
      )}
    >
      <UserRound aria-hidden className="size-4 shrink-0 text-dawn" />
      <span className="truncate">{account ? <bdi>{account.name}</bdi> : t("signIn")}</span>
    </Link>
  );
}
