"use client";

import { Eye, EyeOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";

import { countries, type FixedNames } from "@/lib/account/countries";
import { cn } from "@/lib/utils";

const INPUT = "min-h-12 w-full min-w-0 rounded-xl border-2 border-border bg-card px-3 text-base aria-invalid:border-destructive";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string | null;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
};

/** A label, the control, and its hint and error, wired together for assistive technology. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cn(INPUT, className)} />;
}

/** A password input with a show/hide switch; the text stays left to right in both languages. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const t = useTranslations("Account");
  const [visible, setVisible] = useState(false);
  return (
    // Left to right as a whole, so the switch sits after the text in Arabic too.
    <div dir="ltr" className="relative">
      <input {...props} type={visible ? "text" : "password"} className={cn(INPUT, "pe-14", className)} />
      <button
        type="button"
        onClick={() => setVisible((shown) => !shown)}
        aria-pressed={visible}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        className="absolute inset-y-0 end-0 inline-flex w-12 items-center justify-center rounded-e-xl text-muted-foreground hover:text-foreground"
      >
        {visible ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
      </button>
    </div>
  );
}

const noSubscription = () => () => undefined;

/** The country names Rehla sets itself rather than taking the browser's. */
export function useFixedCountryNames(): FixedNames {
  const t = useTranslations("Account");
  const palestine = t("countryNames.PS");
  return useMemo(() => ({ PS: palestine }), [palestine]);
}

/**
 * Every country by its name in the page language, with "prefer not to say" first. The names come
 * from the browser, so the list is filled in after hydration rather than from the server's data.
 */
export function CountrySelect({ value, onChange, ...props }: Omit<ComponentProps<"select">, "value" | "onChange"> & { value: string | null; onChange: (code: string | null) => void }) {
  const t = useTranslations("Account");
  const locale = useLocale();
  const fixed = useFixedCountryNames();
  const hydrated = useSyncExternalStore(noSubscription, () => true, () => false);
  const options = useMemo(() => (hydrated ? countries(locale, fixed) : []), [hydrated, locale, fixed]);
  return (
    <select {...props} value={value ?? ""} onChange={(event) => onChange(event.target.value || null)} className={INPUT}>
      <option value="">{t("countryNone")}</option>
      {options.map((country) => (
        <option key={country.code} value={country.code}>
          {country.name}
        </option>
      ))}
    </select>
  );
}

/** A message about the whole form: announced when it appears. */
export function FormMessage({ tone, children }: { tone: "error" | "done"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl border px-4 py-3 font-medium",
        tone === "error" ? "border-destructive/40 bg-destructive/8 text-destructive" : "border-oasis/40 bg-oasis/8 text-oasis-text",
      )}
    >
      {children}
    </p>
  );
}

export const looksLikeEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
