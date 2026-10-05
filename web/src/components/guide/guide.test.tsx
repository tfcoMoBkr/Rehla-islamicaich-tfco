import { readFileSync } from "node:fs";
import path from "node:path";

import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { referralCentresSchema } from "@/lib/content/schema";

import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const storage = new Map<string, string>();
const deviceWindow = {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};

const centres = referralCentresSchema.parse(JSON.parse(readFileSync(path.resolve(__dirname, "../../../../content/referral-centers.json"), "utf8")));
const sample = { stations: [{ id: "1", title: "The Beginning" }, { id: "2", title: "Purification" }, { id: "3", title: "Prayer" }], line: null, activity: null, question: null };

async function render(locale: "ar" | "en", element: (modules: { GuidePanel: typeof import("./guide-panel").GuidePanel; TourHost: typeof import("./guide-host").TourHost }) => ReactNode) {
  const [{ GuidePanel }, { TourHost }, { ReferralCentresProvider }] = await Promise.all([
    import("./guide-panel"),
    import("./guide-host"),
    import("@/components/specialists/centres-context"),
  ]);
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : en} timeZone="UTC">
      <ReferralCentresProvider value={centres}>{element({ GuidePanel, TourHost })}</ReferralCentresProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  storage.clear();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("the Khutuwat tour", () => {
  it("shows on a first visit, stays closed once skipped, and comes back when asked for", async () => {
    vi.stubGlobal("window", deviceWindow);
    const store = await import("@/lib/guide-store");
    expect(store.guideVisible()).toBe(true);
    store.closeGuide();
    expect(store.guideVisible()).toBe(false);
    expect(storage.get("rehla.guide.v1")).toBe("seen");

    vi.resetModules();
    const later = await import("@/lib/guide-store");
    expect(later.guideVisible()).toBe(false);
    later.replayGuide();
    expect(later.guideVisible()).toBe(true);
    later.closeGuide();
    expect(later.guideVisible()).toBe(false);
  });

  it("is never in the page as served, so it cannot hold the page back while it loads", async () => {
    expect(await render("en", ({ TourHost }) => <TourHost sample={sample} />)).toBe("");
  });

  it("sits beside the page without a backdrop, with Skip always offered", async () => {
    for (const locale of ["ar", "en"] as const) {
      const html = await render(locale, ({ GuidePanel }) => <GuidePanel sample={sample} focus={false} />);
      const messages = locale === "ar" ? ar : en;
      expect(html).toMatch(/^<section/);
      expect(html).not.toContain("aria-modal");
      expect(html).not.toContain("<dialog");
      expect(html).not.toContain("inset-0");
      expect(html).toContain(messages.Guide.skip);
      expect(html).toContain(messages.Guide.next);
      expect(html).toContain(messages.Guide.steps.road.title);
    }
  });
});
