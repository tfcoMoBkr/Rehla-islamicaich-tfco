import { notFound } from "next/navigation";
import { hasLocale, type Locale } from "next-intl";

import { routing } from "./routing";

export const localeDirection: Record<Locale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
};

export function resolveLocale(value: string): Locale {
  if (!hasLocale(routing.locales, value)) {
    notFound();
  }
  return value;
}
