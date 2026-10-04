import { readFileSync } from "node:fs";
import path from "node:path";

import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { referralCentresSchema, type ReferralCentre } from "@/lib/content/schema";
import { centresByIds, CITY_LIMIT } from "@/lib/referral/centres";

import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import { SpecialistCardView } from "./specialist-card";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const file = path.resolve(__dirname, "../../../../content/referral-centers.json");
const { centers } = referralCentresSchema.parse(JSON.parse(readFileSync(file, "utf8")));

function render(centres: readonly ReferralCentre[], city: string | null, locale: "ar" | "en" = "en"): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en}>
      <SpecialistCardView centres={centres} city={city} onChooseCity={() => undefined} />
    </NextIntlClientProvider>,
  );
}

const shownIds = (html: string) => [...html.matchAll(/data-centre="([^"]+)"/g)].map((match) => match[1]);
const national = centers.filter((centre) => centre.type === "nationalChannel");
const associationCities = centers.filter((centre) => centre.type === "association").map((centre) => centre.city.ar);
const cityWithMost = [...new Set(associationCities)].sort(
  (a, b) => associationCities.filter((city) => city === b).length - associationCities.filter((city) => city === a).length,
)[0];

describe("the specialist card", () => {
  it("shows only the national channel and the city picker when no city is chosen", () => {
    const html = render(centers, null);
    expect(national.length).toBeGreaterThan(0);
    expect(shownIds(html)).toEqual(national.map((centre) => centre.id));
    expect(html).toContain("<select");
    expect(html).toContain(en.Specialist.outside);
    expect(html).toContain('href="/talk-to-a-specialist"');
  });

  it("shows the national channel first, then at most the city limit of that city's associations", () => {
    const ids = shownIds(render(centers, cityWithMost ?? null));
    expect(ids.slice(0, national.length)).toEqual(national.map((centre) => centre.id));
    const associations = ids.slice(national.length);
    expect(associations.length).toBeGreaterThan(0);
    expect(associations.length).toBeLessThanOrEqual(CITY_LIMIT);
    for (const id of associations) {
      expect(centers.find((centre) => centre.id === id)?.city.ar).toBe(cityWithMost);
    }
  });

  it("renders every name and number from the data file and nothing else", () => {
    for (const locale of ["ar", "en"] as const) {
      const html = render(centers, cityWithMost ?? null, locale);
      for (const id of shownIds(html)) {
        const centre = centers.find((candidate) => candidate.id === id);
        expect(centre).toBeDefined();
        if (centre) expect(html).toContain(locale === "en" && centre.name.en ? centre.name.en : centre.name.ar);
      }
    }
  });

  it("does not show a body the service names but the data file lacks, nor an unknown city", () => {
    const named = centresByIds(centers, [...national.map((centre) => centre.id), "not-in-the-file"]);
    expect(shownIds(render(named, null))).toEqual(national.map((centre) => centre.id));
    expect(shownIds(render(centers, "مدينة غير مدرجة"))).toEqual(national.map((centre) => centre.id));
  });

  it("writes phone links a phone can dial", () => {
    const html = [...new Set(associationCities)].map((city) => render(centers, city)).join("");
    const links = [...html.matchAll(/href="(tel:[^"]*)"/g)].map((match) => match[1]);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toMatch(/^tel:\+?\d+$/);
  });
});
