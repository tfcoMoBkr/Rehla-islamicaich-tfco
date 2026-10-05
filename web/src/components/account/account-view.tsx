"use client";

import { HardDrive, LogOut, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { readAccount, signOut, type Profile } from "@/lib/account/actions";
import { hasStoredSession } from "@/lib/account/session";

import { DataSection } from "./data-section";
import { FormMessage } from "./fields";
import { PasswordSection } from "./password-section";
import { ProfileSection } from "./profile-section";
import { SyncStatus } from "./sync-status";

type View =
  | { kind: "loading" }
  | { kind: "signedOut"; notice: "signedOut" | "deleted" | null }
  | { kind: "failed" }
  | { kind: "ready"; email: string; profile: Profile };

export function AccountView() {
  const t = useTranslations("Account");
  const [view, setView] = useState<View>({ kind: "loading" });

  useEffect(() => {
    let current = true;
    // A guest has no session to read, and does not download the sign-in library for this page.
    const read = hasStoredSession() ? readAccount() : Promise.resolve({ ok: false, error: "signedOut" } as const);
    void read.then((result) => {
      if (!current) return;
      if (result.ok) setView({ kind: "ready", email: result.email, profile: result.profile });
      else setView(result.error === "signedOut" ? { kind: "signedOut", notice: null } : { kind: "failed" });
    });
    return () => {
      current = false;
    };
  }, []);

  if (view.kind === "loading") {
    return (
      <p role="status" className="text-muted-foreground">
        {t("loading")}
      </p>
    );
  }
  if (view.kind === "failed") return <FormMessage tone="error">{t("errors.network")}</FormMessage>;
  if (view.kind === "signedOut") return <SignedOut notice={view.notice} />;

  const { email, profile } = view;
  const signedOut = (notice: "signedOut" | "deleted") => {
    setView({ kind: "signedOut", notice });
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="grid gap-8">
      <SyncStatus />
      <Card className="gap-10 px-5 sm:px-8">
        <ProfileSection
          email={email}
          name={profile.display_name}
          country={profile.country}
          onSaved={(name, country) => setView({ ...view, profile: { ...profile, display_name: name, country } })}
        />
        <StoredSection />
        <PasswordSection />
        <DataSection onDeleted={() => signedOut("deleted")} />
        <SignOutSection onSignedOut={() => signedOut("signedOut")} />
      </Card>
    </div>
  );
}

function SignedOut({ notice }: { notice: "signedOut" | "deleted" | null }) {
  const t = useTranslations("Account");
  return (
    <div className="grid gap-6">
      {notice && <FormMessage tone="done">{t(notice)}</FormMessage>}
      <Card className="gap-4 px-5 sm:px-8">
        <h2 className="font-display text-2xl font-semibold">{t("signedOutTitle")}</h2>
        <p>{t("optional")}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/account/sign-in">{t("signIn")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/account/sign-up">{t("create")}</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/learn">{t("guest")}</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}

/** What the account holds, and what never leaves this device. */
function StoredSection() {
  const t = useTranslations("Account");
  return (
    <section aria-labelledby="account-stored" className="grid gap-4">
      <h2 id="account-stored" className="font-display text-2xl font-semibold">
        {t("storedTitle")}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid content-start gap-2 rounded-2xl border border-hairline bg-background p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <UserRound aria-hidden className="size-5 text-oasis-text" />
            {t("inAccountTitle")}
          </h3>
          <ul className="grid list-inside list-disc gap-2 text-sm marker:text-oasis">
            <li>{t("inAccountProfile")}</li>
            <li>{t("inAccountProgress")}</li>
          </ul>
          <p className="text-sm text-muted-foreground">{t("inAccountPassword")}</p>
        </div>
        <div className="grid content-start gap-2 rounded-2xl border border-dashed border-hairline p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <HardDrive aria-hidden className="size-5 text-dawn" />
            {t("onDeviceTitle")}
          </h3>
          <p className="text-sm font-medium">{t("onDeviceRafiq")}</p>
          <p className="text-sm text-muted-foreground">{t("onDeviceOther")}</p>
        </div>
      </div>
      <Link href="/privacy" className="justify-self-start text-sm font-medium underline underline-offset-4">
        {t("privacyLink")}
      </Link>
    </section>
  );
}

function SignOutSection({ onSignedOut }: { onSignedOut: () => void }) {
  const t = useTranslations("Account");
  const [unsaved, setUnsaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function leave(force: boolean) {
    setBusy(true);
    const result = await signOut({ force });
    setBusy(false);
    if (result.ok) onSignedOut();
    else setUnsaved(true);
  }

  return (
    <section aria-labelledby="account-sign-out" className="grid gap-4 border-t border-hairline pt-8">
      <h2 id="account-sign-out" className="sr-only">
        {t("signOut")}
      </h2>
      <p className="text-muted-foreground">{t("signOutBody")}</p>
      {unsaved ? (
        <div role="alert" className="grid gap-3 rounded-2xl border-2 border-dawn/50 bg-dawn/8 p-5">
          <p className="font-semibold">{t("unsavedTitle")}</p>
          <p>{t("unsavedBody")}</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setUnsaved(false)}>{t("stay")}</Button>
            <Button variant="outline" disabled={busy} onClick={() => void leave(true)}>
              {t("signOutAnyway")}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" disabled={busy} className="justify-self-start" onClick={() => void leave(false)}>
          <LogOut aria-hidden className="rtl:-scale-x-100" />
          {busy ? t("working") : t("signOut")}
        </Button>
      )}
    </section>
  );
}
