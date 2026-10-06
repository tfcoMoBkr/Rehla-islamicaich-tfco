import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { QuoteView } from "@/lib/mawqif/types";

import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import { QuoteCard } from "./quote";

const MESSAGES = { ar, en };

function render(locale: "ar" | "en", node: ReactNode): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      {node}
    </NextIntlClientProvider>,
  ).replaceAll("&#x27;", "'");
}

const hadith = { kind: "hadith", citation: "رواه البخاري", grade: null, url: null } as const;
const phrase = (text: string): QuoteView => ({
  ref: "h3433",
  text,
  source: hadith,
  say: { arabic: "يَرْحَمُكَ الله", pronunciation: "yarḥamuka Allāh" },
});

describe("a phrase to say", () => {
  it("shows the Arabic, its approximate pronunciation and the published meaning on an English page", () => {
    const html = render("en", <QuoteCard quote={phrase("'yarhamuk Allah' (may Allah have mercy on you)")} />);
    const order = ["يَرْحَمُكَ الله", en.Mawqif.approxPronunciation, "yarḥamuka Allāh", en.Mawqif.meaningPublished, "may Allah have mercy on you"];
    const positions = order.map((part) => html.indexOf(part));
    expect(positions.every((at) => at >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("shows the Arabic alone on an Arabic page, with no pronunciation", () => {
    const html = render("ar", <QuoteCard quote={phrase("يَرْحَمُكَ الله")} />);
    expect(html).not.toContain(ar.Mawqif.approxPronunciation);
    expect(html).not.toContain("yarḥamuka");
  });

  it("leaves a quote that is not a phrase to say as it was", () => {
    const html = render("en", <QuoteCard quote={{ ref: "x", text: "WORDS", source: hadith }} />);
    expect(html).not.toContain(en.Mawqif.approxPronunciation);
    expect(html).toContain("WORDS");
  });
});
