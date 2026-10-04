import type { Locale } from "next-intl";

import type { ReferralCentre } from "@/lib/content/schema";

/** How many associations of a city a referral shows; the full list is on the specialist page. */
export const CITY_LIMIT = 3;

export type City = { ar: string; en: string | null };

export type PhonePart = { kind: "text"; text: string } | { kind: "number"; text: string; href: string };

/** A dialable number written in a phone field: digits, possibly with a leading +, spaces or dashes. */
const NUMBER = /\+?\d[\d\s-]{2,}\d/g;

export const telHref = (number: string) => `tel:${number.replace(/[^\d+]/g, "")}`;

/**
 * A phone field as given, cut into its numbers (each tap-to-call) and the text around them, which
 * may be a separator or a short note from the directory.
 */
export function phoneParts(text: string): PhonePart[] {
  const parts: PhonePart[] = [];
  let last = 0;
  for (const match of text.matchAll(NUMBER)) {
    if (match.index > last) parts.push({ kind: "text", text: text.slice(last, match.index) });
    parts.push({ kind: "number", text: match[0], href: telHref(match[0]) });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}

/** The national channel first, then the associations, each only if the data file has it. */
export function centresByIds(centres: readonly ReferralCentre[], ids: readonly string[] | undefined): ReferralCentre[] {
  if (!ids) return [...centres];
  const wanted = new Set(ids);
  return centres.filter((centre) => wanted.has(centre.id));
}

export const nationalChannels = (centres: readonly ReferralCentre[]) => centres.filter((centre) => centre.type === "nationalChannel");

/** The cities that have associations, in the order the data lists them. */
export function citiesOf(centres: readonly ReferralCentre[]): City[] {
  const seen = new Map<string, City>();
  for (const centre of centres) {
    if (centre.type === "association" && !seen.has(centre.city.ar)) seen.set(centre.city.ar, centre.city);
  }
  return [...seen.values()];
}

export function associationsIn(centres: readonly ReferralCentre[], city: string | null, limit = CITY_LIMIT): ReferralCentre[] {
  if (!city) return [];
  return centres.filter((centre) => centre.type === "association" && centre.city.ar === city).slice(0, limit);
}

/** A name or city in the page's language when the directory gives one, and in Arabic otherwise. */
export function shown(text: { ar: string; en: string | null }, locale: Locale): { text: string; lang: "ar" | "en" } {
  return locale === "en" && text.en ? { text: text.en, lang: "en" } : { text: text.ar, lang: "ar" };
}
