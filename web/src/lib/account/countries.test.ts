import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";

import { countries, countryName, isListedCountry } from "./countries";

const fixed = { ar: ar.Account.countryNames, en: en.Account.countryNames };

/** A browser whose built-in data names PS differently. */
function stubBrowserNames() {
  const Real = Intl.DisplayNames;
  vi.spyOn(Intl, "DisplayNames").mockImplementation(function (locales: Intl.LocalesArgument, options: Intl.DisplayNamesOptions) {
    const real = new Real(locales, options);
    return Object.assign(Object.create(real), {
      of: (code: string) => (code === "PS" ? (String(locales).startsWith("ar") ? "الأراضي الفلسطينية" : "Palestinian Territories") : real.of(code)),
    });
  } as unknown as typeof Intl.DisplayNames);
}

afterEach(() => vi.restoreAllMocks());

describe("the countries a learner can pick from", () => {
  it.each(["ar", "en"] as const)("leave IL out entirely (%s)", (locale) => {
    expect(countries(locale, fixed[locale]).map((country) => country.code)).not.toContain("IL");
  });

  it("accept PS and refuse IL when a profile is saved", () => {
    expect(isListedCountry("PS")).toBe(true);
    expect(isListedCountry("IL")).toBe(false);
  });

  it("are matched by the database, which refuses IL in a migration of its own", () => {
    const folder = path.resolve(__dirname, "../../../../supabase/migrations");
    const rule = readdirSync(folder)
      .map((name) => readFileSync(path.join(folder, name), "utf8"))
      .find((sql) => sql.includes("profiles_country_not_il"));
    expect(rule).toMatch(/drop constraint if exists profiles_country_not_il;/);
    expect(rule).toMatch(/add constraint profiles_country_not_il check \(country is distinct from 'IL'\);/);
  });

  it("name PS «فلسطين» and “Palestine”, whatever the browser's own data says", () => {
    stubBrowserNames();
    expect(fixed).toEqual({ ar: { PS: "فلسطين" }, en: { PS: "Palestine" } });
    for (const locale of ["ar", "en"] as const) {
      const listed = countries(locale, fixed[locale]).filter((country) => country.code === "PS");
      expect(listed).toEqual([{ code: "PS", name: fixed[locale].PS }]);
      expect(countryName("PS", locale, fixed[locale])).toBe(fixed[locale].PS);
    }
  });

  it("take every other name from the browser", () => {
    expect(countryName("SA", "en", fixed.en)).toBe(new Intl.DisplayNames(["en"], { type: "region" }).of("SA"));
  });
});
