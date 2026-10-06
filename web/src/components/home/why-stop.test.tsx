import { createTranslator } from "next-intl";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";

const language = vi.hoisted(() => ({ current: "en" as "ar" | "en" }));

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({ locale: language.current, messages: language.current === "ar" ? ar : en, namespace: namespace as "Home.why" }),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

describe("why Rehla", () => {
  it.each(["ar", "en"] as const)("opens the road with the question, the need and what Rehla is (%s)", async (locale) => {
    language.current = locale;
    const { WhyStop } = await import("./why-stop");
    const html = renderToStaticMarkup(await WhyStop());
    const copy = (locale === "ar" ? ar : en).Home.why;
    for (const line of [copy.eyebrow, copy.title, copy.body, copy.intro]) expect(html).toContain(line.replaceAll('"', "&quot;"));
    expect(html).toContain('aria-labelledby="why-title"');
    expect(html).not.toMatch(/\{\{|\}\}/);
  });

  it("stands on the road directly before the stations", async () => {
    const { readFileSync } = await import("node:fs");
    const page = readFileSync(new URL("../../app/[locale]/page.tsx", import.meta.url), "utf8");
    expect(page.indexOf("<WhyStop />")).toBeGreaterThan(-1);
    expect(page.indexOf("<WhyStop />")).toBeLessThan(page.indexOf("<StationsStop />"));
  });
});
