import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ReferralCentresProvider } from "@/components/specialists/centres-context";
import type { RafiqAnswer } from "@/lib/rafiq/answer";

import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import { AnswerView } from "./answer-view";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/answer-fonts", () => ({ ANSWER_FONT_VARIABLES: { ar: "", en: "", ur: "", bn: "", fr: "" } }));

const MESSAGES = { ar, en };
type Locale = keyof typeof MESSAGES;
const centres = { centers: [], updated: "2026-10-01", note: { ar: "", en: "" } } as never;

function render(locale: Locale, node: ReactNode): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      <ReferralCentresProvider value={centres}>{node}</ReferralCentresProvider>
    </NextIntlClientProvider>,
  ).replaceAll("&#x27;", "'");
}

const source = { n: 1, sourceId: "s", title: "Book", reference: "1", url: "https://example.org", publisher: "P" };
const shaped = (language: Locale): RafiqAnswer => ({
  kind: "answer",
  language,
  level: "A",
  referred: false,
  opening: null,
  blocks: [
    { type: "text", role: "answer", text: "ANSWER-TEXT [1]." },
    { type: "text", role: "explanation", text: "EXPLANATION-TEXT [1]." },
  ],
  sources: [source],
  encouragement: "ENCOURAGEMENT-LINE",
  followUp: "NEXT-STEP",
  referral: null,
  laterLessonId: null,
  languageFallback: false,
});

describe("the shape of a religious answer", () => {
  it.each(["ar", "en"] as const)("labels the answer and the explanation apart, then encourages and offers a next step (%s)", (locale) => {
    const t = MESSAGES[locale].Rafiq;
    const html = render(locale, <AnswerView answer={shaped(locale)} id="a" onFollowUp={() => undefined} />);
    expect(html.indexOf(t.generatedAnswer)).toBeLessThan(html.indexOf("ANSWER-TEXT"));
    expect(html.indexOf(t.generatedExplanation)).toBeLessThan(html.indexOf("EXPLANATION-TEXT"));
    expect(html.indexOf("EXPLANATION-TEXT")).toBeLessThan(html.indexOf("ENCOURAGEMENT-LINE"));
    expect(html.indexOf("ENCOURAGEMENT-LINE")).toBeLessThan(html.indexOf("NEXT-STEP"));
    for (const action of Object.values(t.actions)) expect(html).toContain(`>${action}</button>`);
  });

  it("offers the quick actions only where they can be asked, and never under a referral", () => {
    expect(render("en", <AnswerView answer={shaped("en")} id="a" />)).not.toContain(en.Rafiq.actions.more);
    const referral: RafiqAnswer = { ...shaped("en"), kind: "referral", referred: true, referral: { reason: "unexplained", links: [], centers: [] } };
    const html = render("en", <AnswerView answer={referral} id="a" onFollowUp={() => undefined} />);
    expect(html).not.toContain(en.Rafiq.actions.more);
    expect(html).toContain(en.Rafiq.referral.unexplained.title);
  });
});

describe("cards for the learner's own case", () => {
  const personal = (region: "outside" | null): RafiqAnswer => ({
    ...shaped("en"),
    kind: "referral",
    referred: true,
    blocks: [],
    sources: [],
    encouragement: null,
    followUp: null,
    referral: { reason: "personalCase", links: ["/talk-to-a-specialist"], centers: [], region },
  });

  it.each(["ar", "en"] as const)("open with reassurance, not with a warning, when Rafiq wrote no opening (%s)", (locale) => {
    const t = MESSAGES[locale].Rafiq;
    const html = render(locale, <AnswerView answer={{ ...personal(null), language: locale }} id="a" />);
    expect(html.indexOf(t.reassure)).toBeGreaterThan(-1);
    expect(html.indexOf(t.reassure)).toBeLessThan(html.indexOf(t.referral.personalCase.title));
  });

  it.each(["ar", "en"] as const)("lead with the guidance for learners outside the Kingdom when they said so (%s)", (locale) => {
    const s = MESSAGES[locale].Specialist;
    const outside = render(locale, <AnswerView answer={{ ...personal("outside"), language: locale }} id="a" />);
    expect(outside).toContain(s.outside);
    expect(outside).toContain(s.insideKingdom);
    expect(outside).not.toContain(s.cityLabel);
    const inside = render(locale, <AnswerView answer={{ ...personal(null), language: locale }} id="a" />);
    expect(inside).not.toContain(s.insideKingdom);
  });
});

describe("cards for the new honest outcomes", () => {
  it.each(["unexplained", "verseNotFound", "hadithNotFound", "timeout", "dailyCap"] as const)("has its words in both languages (%s)", (reason) => {
    for (const locale of ["ar", "en"] as const) {
      const card = MESSAGES[locale].Rafiq.referral[reason];
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.body.length).toBeGreaterThan(0);
    }
  });
});
