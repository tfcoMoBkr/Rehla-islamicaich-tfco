"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { changePassword, PASSWORD_MIN_LENGTH } from "@/lib/account/actions";
import type { AccountError } from "@/lib/account/errors";

import { Field, FormMessage, PasswordInput } from "./fields";

type Problem = AccountError | "passwordShort";

export function PasswordSection() {
  const t = useTranslations("Account");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<Problem | null>(null);
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setChanged(false);
    if (next.length < PASSWORD_MIN_LENGTH) {
      setError("passwordShort");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await changePassword(current, next);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCurrent("");
    setNext("");
    setChanged(true);
  }

  const currentError = error === "currentPasswordWrong" ? t("errors.currentPasswordWrong") : null;
  const nextError = error === "passwordShort" || error === "weakPassword" || error === "samePassword" ? t(`errors.${error}`) : null;

  return (
    <section aria-labelledby="account-password" className="grid gap-4">
      <h2 id="account-password" className="font-display text-2xl font-semibold">
        {t("passwordTitle")}
      </h2>
      <form onSubmit={submit} noValidate className="grid gap-5">
        <Field label={t("currentPassword")} error={currentError}>
          {(props) => <PasswordInput {...props} autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} required />}
        </Field>
        <Field label={t("newPassword")} hint={t("passwordHint")} error={nextError}>
          {(props) => (
            <PasswordInput {...props} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} value={next} onChange={(event) => setNext(event.target.value)} required />
          )}
        </Field>
        {error && !currentError && !nextError && <FormMessage tone="error">{t(`errors.${error}`)}</FormMessage>}
        {changed && <FormMessage tone="done">{t("passwordChanged")}</FormMessage>}
        <Button type="submit" variant="outline" disabled={busy} className="justify-self-start">
          {busy ? t("working") : t("changePassword")}
        </Button>
      </form>
    </section>
  );
}
