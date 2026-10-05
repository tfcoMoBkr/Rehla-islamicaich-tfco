"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { hasRecoverySession, PASSWORD_MIN_LENGTH, setNewPassword } from "@/lib/account/actions";
import type { AccountError } from "@/lib/account/errors";

import { Field, FormMessage, PasswordInput } from "./fields";

type LinkState = "checking" | "valid" | "expired";

/** Opened from a reset email: the link signs this browser in for long enough to choose a new password. */
export function NewPasswordForm() {
  const t = useTranslations("Account");
  const router = useRouter();
  const [link, setLink] = useState<LinkState>("checking");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AccountError | "passwordShort" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    void hasRecoverySession().then((valid) => {
      if (current) setLink(valid ? "valid" : "expired");
    });
    return () => {
      current = false;
    };
  }, []);

  if (link === "checking") {
    return (
      <p role="status" className="text-muted-foreground">
        {t("checkingLink")}
      </p>
    );
  }
  if (link === "expired") {
    return (
      <div className="grid gap-4">
        <h2 className="font-display text-2xl font-semibold">{t("linkExpiredTitle")}</h2>
        <p>{t("linkExpiredBody")}</p>
        <Button asChild className="justify-self-start">
          <Link href="/account/reset">{t("askAgain")}</Link>
        </Button>
      </div>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError("passwordShort");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await setNewPassword(password);
    setBusy(false);
    if (result.ok) router.push("/account");
    else if (result.error === "linkExpired") setLink("expired");
    else setError(result.error);
  }

  const fieldError = error === "passwordShort" || error === "weakPassword" || error === "samePassword" ? t(`errors.${error}`) : null;

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <Field label={t("newPassword")} hint={t("passwordHint")} error={fieldError}>
        {(props) => <PasswordInput {...props} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} value={password} onChange={(event) => setPassword(event.target.value)} required />}
      </Field>
      {error && !fieldError && <FormMessage tone="error">{t(`errors.${error}`)}</FormMessage>}
      <Button type="submit" size="lg" disabled={busy} className="justify-self-stretch sm:justify-self-start">
        {busy ? t("working") : t("newPasswordSave")}
      </Button>
    </form>
  );
}
