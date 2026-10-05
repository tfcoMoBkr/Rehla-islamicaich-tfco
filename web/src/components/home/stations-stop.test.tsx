import { createTranslator } from "next-intl";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Feature } from "@/config/features";

import en from "../../../messages/en.json";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => createTranslator({ locale: "en", messages: en, namespace: namespace as "Home.stations" }),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

/** The stations as rendered, with the flags as given (the rest as in features.ts). */
async function render(overrides: Partial<Record<Feature, boolean>> = {}) {
  vi.resetModules();
  const config = await vi.importActual<typeof import("@/config/features")>("@/config/features");
  const features = { ...config.features, ...overrides };
  vi.doMock("@/config/features", () => ({ ...config, features }));
  const { StationsStop } = await import("./stations-stop");
  const html = renderToStaticMarkup(await StationsStop());
  // One <li> per station: its marker and its card.
  const stations = html.split("<li").slice(1);
  return { sections: config.sections, features, stations };
}

beforeEach(() => vi.doUnmock("@/config/features"));

describe("the stations of the journey", () => {
  it("shows every section in the order of features.ts: a lit, linked station when on, an unlit one marked Soon when off", async () => {
    const { sections, features, stations } = await render();
    expect(stations).toHaveLength(sections.length);
    sections.forEach(({ feature, href }, index) => {
      const station = stations[index] ?? "";
      expect(station, feature).toContain(en.Home.stations[feature].name);
      if (features[feature]) {
        expect(station, feature).toContain('data-light="reach"');
        expect(station, feature).toContain(`href="${href}"`);
        expect(station, feature).not.toContain(`>${en.Home.stations.soon}<`);
      } else {
        expect(station, feature).not.toContain("data-light");
        expect(station, feature).not.toContain("<a ");
        expect(station, feature).toContain(`>${en.Home.stations.soon}<`);
      }
    });
  });

  it("puts Khutuwat, Practice and Ask Rafiq first, all lit today", async () => {
    const { sections, stations } = await render();
    expect(sections.slice(0, 3).map((section) => section.feature)).toEqual(["learn", "practice", "rafiq"]);
    for (const station of stations.slice(0, 3)) expect(station).toContain('data-light="reach"');
  });

  it("lights a station when its flag is turned on, with no other change", async () => {
    const before = await render({ mawqif: false });
    const after = await render({ mawqif: true });
    const index = before.sections.findIndex((section) => section.feature === "mawqif");
    expect(before.stations[index]).not.toContain("data-light");
    expect(after.stations[index]).toContain('data-light="reach"');
    expect(after.stations[index]).toContain('href="/mawqif"');
    expect(after.stations.filter((_, position) => position !== index)).toEqual(before.stations.filter((_, position) => position !== index));
  });
});
