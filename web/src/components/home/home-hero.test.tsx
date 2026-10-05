import { createTranslator, NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { RafiqPosesProvider, type RafiqPoses } from "@/components/rafiq/rafiq-figure";

import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";

const MESSAGES = { ar, en };
let locale: "ar" | "en" = "en";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => createTranslator({ locale, messages: MESSAGES[locale], namespace: namespace as "Home" }),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const pose = { src: "/art/rafiq/hello.png", width: 400, height: 600 };
const poses = new Proxy({}, { get: () => pose }) as RafiqPoses;

async function renderHero(language: "ar" | "en") {
  locale = language;
  const { HomeHero } = await import("./home-hero");
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={language} messages={MESSAGES[language]} timeZone="UTC">
      <RafiqPosesProvider poses={poses}>{await HomeHero()}</RafiqPosesProvider>
    </NextIntlClientProvider>,
  );
}

describe("the home hero", () => {
  it.each(["ar", "en"] as const)("offers the road and a specialist side by side (%s)", async (language) => {
    const html = await renderHero(language);
    const home = MESSAGES[language].Home;
    const links = [...html.matchAll(/<a href="([^"]+)"[^>]*>(.*?)<\/a>/g)].map((match) => ({ href: match[1], text: match[2] }));

    expect(links.map((link) => link.href)).toEqual(["/learn", "/talk-to-a-specialist"]);
    expect(links[0]?.text).toContain(home.startRoad);
    expect(links[1]?.text).toContain(home.askSpecialist);
    // The specialists' introduction belongs to their page; on the home page it would read as Rehla's own.
    expect(html).not.toContain(MESSAGES[language].Specialist.intro);
    expect(html.match(/<p[ >]/g)).toHaveLength(2);
  });

  it("sets the tagline in the full foreground colour, not a muted one", async () => {
    const html = await renderHero("en");
    const tagline = new RegExp(`<p class="([^"]*)">${en.Home.tagline}</p>`).exec(html);
    expect(tagline?.[1]).toContain("text-foreground");
    expect(tagline?.[1]).not.toContain("muted");
  });
});
