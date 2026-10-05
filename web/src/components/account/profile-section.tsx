"use client";

import { useLocale, useTranslations, type Locale } from "next-intl";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { updateProfile } from "@/lib/account/actions";
import { countryName } from "@/lib/account/countries";
import type { AccountError } from "@/lib/account/errors";
import { DISPLAY_NAME_MAX_LENGTH } from "@/lib/account/session";

import { CountrySelect, Field, FormMessage, TextInput, useFixedCountryNames } from "./fields";

type ProfileSectionProps = { email: string; name: string; country: string | null; onSaved: (name: string, country: string | null) => void };

export function ProfileSection({ email, name, country, onSaved }: ProfileSectionProps) {
  const t = useTranslations("Account");
  const locale = useLocale() as Locale;
  const fixedNames = useFixedCountryNames();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftCountry, setDraftCountry] = useState(country);
  const [error, setError] = useState<AccountError | "nameRequired" | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    const trimmed = draftName.trim();
    if (!trimmed) {
      setError("nameRequired");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await updateProfile(trimmed, draftCountry, locale);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved(trimmed, draftCountry);
    setEditing(false);
    setSaved(true);
  }

  return (
    <section aria-labelledby="account-profile" className="grid gap-4">
      <h2 id="account-profile" className="font-display text-2xl font-semibold">
        {t("profileTitle")}
      </h2>
      {editing ? (
        <form onSubmit={save} noValidate className="grid gap-5">
          <Field label={t("displayName")} error={error === "nameRequired" ? t("errors.nameRequired") : null}>
            {(props) => (
              <TextInput {...props} dir="auto" autoComplete="nickname" maxLength={DISPLAY_NAME_MAX_LENGTH} value={draftName} onChange={(event) => setDraftName(event.target.value)} required />
            )}
          </Field>
          <Field label={t("country")} error={error === "countryNotListed" ? t("errors.countryNotListed") : null}>
            {(props) => <CountrySelect {...props} value={draftCountry} onChange={setDraftCountry} />}
          </Field>
          {error && error !== "nameRequired" && error !== "countryNotListed" && <FormMessage tone="error">{t(`errors.${error}`)}</FormMessage>}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? t("working") : t("save")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <dl className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-8">
            <dt className="text-sm text-muted-foreground">{t("displayName")}</dt>
            <dd className="text-lg font-semibold wrap-break-word">
              <bdi>{name}</bdi>
            </dd>
            <dt className="text-sm text-muted-foreground">{t("country")}</dt>
            <dd>{country ? countryName(country, locale, fixedNames) : t("noCountry")}</dd>
            <dt className="text-sm text-muted-foreground">{t("email")}</dt>
            <dd className="break-all">
              <bdi dir="ltr">{email}</bdi>
            </dd>
          </dl>
          <Button
            variant="outline"
            className="justify-self-start"
            onClick={() => {
              setDraftName(name);
              setDraftCountry(country);
              setSaved(false);
              setEditing(true);
            }}
          >
            {t("edit")}
          </Button>
          {saved && <FormMessage tone="done">{t("profileSaved")}</FormMessage>}
        </>
      )}
    </section>
  );
}
