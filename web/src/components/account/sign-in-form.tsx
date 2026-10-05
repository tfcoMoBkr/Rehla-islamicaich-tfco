"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { signIn } from "@/lib/account/actions";
import type { AccountError } from "@/lib/account/errors";
import { useAccount } from "@/lib/account/session";

import { Field, FormMessage, looksLikeEmail, PasswordInput, TextInput } from "./fields";
import { SignedInNote } from "./signed-in-note";

/** Signing in joins this device's progress with the account's. */
export function SignInForm() {
  const t = useTranslations("Account");
  const router = useRouter();
  const account = useAccount();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AccountError | null>(null);
  const [busy, setBusy] = useState(false);

  if (account) return <SignedInNote account={account} />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!looksLikeEmail(email.trim()) || !password) {
      setError(looksLikeEmail(email.trim()) ? "wrongPassword" : "badEmail");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await signIn(email.trim(), password);
    setBusy(false);
    if (result.ok) router.push("/account");
    else setError(result.error);
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <Field label={t("email")}>
        {(props) => <TextInput {...props} type="email" autoComplete="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} required />}
      </Field>
      <Field label={t("password")}>
        {(props) => <PasswordInput {...props} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />}
      </Field>
      <Link href="/account/reset" className="justify-self-start text-sm font-medium underline underline-offset-4">
        {t("forgot")}
      </Link>

      <p className="text-sm text-muted-foreground">{t("signInMerge")}</p>
      {error && <FormMessage tone="error">{t(`errors.${error}`)}</FormMessage>}

      <Button type="submit" size="lg" disabled={busy} className="justify-self-stretch sm:justify-self-start">
        {busy ? t("working") : t("signIn")}
      </Button>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-hairline pt-5">
        <p>
          {t("noAccount")}{" "}
          <Link href="/account/sign-up" className="font-semibold underline underline-offset-4">
            {t("create")}
          </Link>
        </p>
        <Link href="/learn" className="font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground">
          {t("guest")}
        </Link>
      </div>
    </form>
  );
}
