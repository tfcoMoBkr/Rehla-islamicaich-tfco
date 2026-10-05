"use client";

import { useTranslations } from "next-intl";

import { Lantern } from "@/components/journey/lantern";
import { Button } from "@/components/ui/button";
import { accountsEnabled } from "@/config/accounts";
import { Link } from "@/i18n/navigation";
import { useAccount } from "@/lib/account/session";
import { textStore } from "@/lib/device-store";
import { useProgress } from "@/lib/learn/progress-store";

/** Dismissed once, never shown again on this device; kept on sign-out like the language. */
export const inviteDismissed = textStore("rehla.invite.v1");

/** Only a guest who has completed a lesson and has not said "not now". */
export function shouldInvite({ signedIn, dismissed, completedLessons }: { signedIn: boolean; dismissed: boolean; completedLessons: number }): boolean {
  return accountsEnabled() && !signedIn && !dismissed && completedLessons > 0;
}

/**
 * A gentle invitation after the first completed lesson to keep progress in an account. Never
 * blocking, and only for a guest.
 */
export function AccountInvite() {
  const t = useTranslations("AccountInvite");
  const signedIn = useAccount() !== null;
  const dismissed = inviteDismissed.use() !== null;
  const completedLessons = Object.keys(useProgress().completedLessons).length;
  if (!shouldInvite({ signedIn, dismissed, completedLessons })) return null;

  return (
    <aside aria-labelledby="account-invite" className="tone-day grid gap-3 rounded-2xl border-2 border-dawn/60 bg-paper p-5 text-foreground">
      <div className="flex items-center gap-3">
        <Lantern className="size-9 shrink-0 text-ink" />
        <h2 id="account-invite" className="font-display text-xl font-semibold">
          {t("title")}
        </h2>
      </div>
      <p>{t("body")}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button asChild>
          <Link href="/account/sign-up">{t("create")}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/account/sign-in">{t("signIn")}</Link>
        </Button>
        <Button variant="ghost" onClick={() => inviteDismissed.set("dismissed")}>
          {t("notNow")}
        </Button>
      </div>
    </aside>
  );
}
