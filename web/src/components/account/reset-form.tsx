"use client";

import { MailCheck } from "lucide-react";
import { useLocale, useTranslations, type Locale } from "next-intl";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { requestPasswordReset } from "@/lib/account/actions";
import type { AccountError } from "@/lib/account/errors";

import { Field, FormMessage, looksLikeEmail, TextInput } from "./fields";

/** Shown while Rehla cannot send email: no button that would silently fail, and a way forward. */
function ResetUnavailable() {
  const t = useTranslations("Account");
  return (
    <div className="grid gap-4">
      <h2 className="font-display text-2xl font-semibold">{t("resetUnavailableTitle")}</h2>
      <p>{t("resetUnavailableBody")}</p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/account/sign-up">{t("create")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/account/sign-in">{t("signIn")}</Link>
        </Button>
      </div>
    </div>
  );
}

export function ResetForm({ available }: { available: boolean }) {
  const t = useTranslations("Account");
  const locale = useLocale() as Locale;
  const [email, setEmail] = useState("");
  const [error, setError] = useState<AccountError | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(!available);

  if (unavailable) return <ResetUnavailable />;
  if (sentTo) {
    return (
      <p role="status" className="flex items-start gap-3 text-lg">
        <MailCheck aria-hidden className="mt-1 size-6 shrink-0 text-oasis-text" />
        {t("resetSent", { email: sentTo })}
      </p>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!looksLikeEmail(trimmed)) {
      setError("badEmail");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await requestPasswordReset(trimmed, locale);
    setBusy(false);
    if (result.ok) setSentTo(trimmed);
    else if (result.error === "resetUnavailable") setUnavailable(true);
    else setError(result.error);
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <Field label={t("email")} error={error === "badEmail" ? t("errors.badEmail") : null}>
        {(props) => <TextInput {...props} type="email" autoComplete="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} required />}
      </Field>
      {error && error !== "badEmail" && <FormMessage tone="error">{t(`errors.${error}`)}</FormMessage>}
      <Button type="submit" size="lg" disabled={busy} className="justify-self-stretch sm:justify-self-start">
        {busy ? t("working") : t("resetSend")}
      </Button>
      <Link href="/account/sign-in" className="justify-self-start font-medium underline underline-offset-4">
        {t("signIn")}
      </Link>
    </form>
  );
}
