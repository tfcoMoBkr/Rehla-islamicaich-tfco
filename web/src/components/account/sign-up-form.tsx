"use client";

import { MailCheck, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations, type Locale } from "next-intl";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { PASSWORD_MIN_LENGTH, signUp } from "@/lib/account/actions";
import type { AccountError } from "@/lib/account/errors";
import { DISPLAY_NAME_MAX_LENGTH, useAccount } from "@/lib/account/session";

import { CountrySelect, Field, FormMessage, looksLikeEmail, PasswordInput, TextInput } from "./fields";
import { SignedInNote } from "./signed-in-note";

type Problem = AccountError | "passwordShort" | "nameRequired";
type FieldErrors = Partial<Record<"email" | "password" | "name" | "country", Problem>>;

/** Email, password and a display name; the country is optional. Guest progress on this device joins the new account. */
export function SignUpForm() {
  const t = useTranslations("Account");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const account = useAccount();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [country, setCountry] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<AccountError | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (sentTo) {
    return (
      <div className="grid gap-3" role="status">
        <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <MailCheck aria-hidden className="size-6 text-oasis-text" />
          {t("checkEmailTitle")}
        </h2>
        <p>{t("checkEmailBody", { email: sentTo })}</p>
      </div>
    );
  }
  if (account) return <SignedInNote account={account} />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    const problems: FieldErrors = {
      ...(looksLikeEmail(trimmedEmail) ? {} : { email: "badEmail" }),
      ...(password.length >= PASSWORD_MIN_LENGTH ? {} : { password: "passwordShort" }),
      ...(trimmedName ? {} : { name: "nameRequired" }),
    };
    setFieldErrors(problems);
    setError(null);
    if (Object.keys(problems).length > 0) return;

    setBusy(true);
    const result = await signUp({ email: trimmedEmail, password, displayName: trimmedName, country, locale });
    setBusy(false);
    if (!result.ok) {
      if (result.error === "weakPassword") setFieldErrors({ password: "weakPassword" });
      else if (result.error === "badEmail") setFieldErrors({ email: "badEmail" });
      else if (result.error === "countryNotListed") setFieldErrors({ country: "countryNotListed" });
      else setError(result.error);
      return;
    }
    if (result.signedIn) router.push("/account");
    else setSentTo(trimmedEmail);
  }

  const message = (problem: Problem | undefined) => (problem ? t(`errors.${problem}`) : null);
  /** Changing a field clears what was said about it. */
  const edit = <T,>(field: keyof FieldErrors, set: (value: T) => void) => (value: T) => {
    set(value);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <Field label={t("email")} error={message(fieldErrors.email)}>
        {(props) => <TextInput {...props} type="email" autoComplete="email" dir="ltr" value={email} onChange={(event) => edit("email", setEmail)(event.target.value)} required />}
      </Field>
      <Field label={t("password")} hint={t("passwordHint")} error={message(fieldErrors.password)}>
        {(props) => (
          <PasswordInput {...props} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} value={password} onChange={(event) => edit("password", setPassword)(event.target.value)} required />
        )}
      </Field>
      <Field label={t("displayName")} hint={t("displayNameHint")} error={message(fieldErrors.name)}>
        {(props) => (
          <TextInput {...props} autoComplete="nickname" dir="auto" maxLength={DISPLAY_NAME_MAX_LENGTH} value={name} onChange={(event) => edit("name", setName)(event.target.value)} required />
        )}
      </Field>
      <Field label={t("country")} error={message(fieldErrors.country)}>
        {(props) => <CountrySelect {...props} value={country} onChange={edit("country", setCountry)} />}
      </Field>

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-oasis-text" />
        <span>
          {t("askNothingElse")}{" "}
          <Link href="/privacy" className="font-medium text-foreground underline underline-offset-4">
            {t("privacyLink")}
          </Link>
        </span>
      </p>

      {error && <FormMessage tone="error">{t(`errors.${error}`)}</FormMessage>}

      <Button type="submit" size="lg" disabled={busy} className="justify-self-stretch sm:justify-self-start">
        {busy ? t("working") : t("create")}
      </Button>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-hairline pt-5">
        <p>
          {t("haveAccount")}{" "}
          <Link href="/account/sign-in" className="font-semibold underline underline-offset-4">
            {t("signIn")}
          </Link>
        </p>
        <Link href="/learn" className="font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground">
          {t("guest")}
        </Link>
      </div>
    </form>
  );
}
