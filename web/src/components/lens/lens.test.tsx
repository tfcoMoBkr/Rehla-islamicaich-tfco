import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { RafiqPosesProvider, type RafiqPoses } from "@/components/rafiq/rafiq-figure";
import { CARDS, type LensResponse } from "@/lib/lens/lens";
import { EXAMPLES } from "@/lib/lens/examples";

import ar from "../../../messages/ar.json";
import en from "../../../messages/en.json";
import { ExampleArt } from "./example-art";
import { LensCard } from "./lens-card";
import { LensResult } from "./lens-result";
import { LensThread, type ThreadItem } from "./lens-thread";
import { LensWorking } from "./lens-working";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string | { pathname: string; query: Record<string, string> }; children: ReactNode }) => (
    <a href={typeof href === "string" ? href : `${href.pathname}?ask=${encodeURIComponent(href.query.ask ?? "")}`}>{children}</a>
  ),
}));
vi.mock("@/lib/answer-fonts", () => ({ ANSWER_FONT_VARIABLES: { ar: "", en: "", ur: "", bn: "", fr: "" } }));

const MESSAGES = { ar, en };
const poses = new Proxy({}, { get: () => ({ src: "/art/rafiq/hello.png", width: 400, height: 600 }) }) as RafiqPoses;
type Locale = keyof typeof MESSAGES;

function render(locale: Locale, node: ReactNode): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      <RafiqPosesProvider poses={poses}>{node}</RafiqPosesProvider>
    </NextIntlClientProvider>,
  );
}

const decoded = (html: string) => html.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#x27;", "'");

function response(fields: Partial<LensResponse>): LensResponse {
  return { seen: { kind: "object", subject: "", visibleText: null, plainTranslation: null, looksLikeScripture: false, peoplePresent: false, confidence: 0.9, category: "ordinary", quality: "good", religiousTerms: [], others: [] }, row: 1, answer: null, card: null, others: [], suggestions: [], ...fields };
}

const noop = () => undefined;
const cited = {
  kind: "answer" as const,
  language: "en" as const,
  level: "A" as const,
  referred: false,
  opening: "Good question, {{name}}.",
  followUp: null,
  blocks: [{ type: "text" as const, role: "answer" as const, text: "A prayer mat is used for prayer [1]." }],
  sources: [{ n: 1, sourceId: "s", title: "Book", reference: "1", url: "https://example.org", publisher: "P" }],
  referral: null,
  laterLessonId: null,
  languageFallback: false,
};

describe("Lens results", () => {
  it.each(["ar", "en"] as const)("shows what this is, then what it means with Rafiq's cited answer (%s)", (locale) => {
    const seen = { ...response({}).seen!, subject: locale === "ar" ? "سجادة صلاة" : "prayer mat" };
    const html = decoded(render(locale, <LensResult response={response({ seen, answer: cited, others: ["miswak"] })} id="lens" onChoose={noop} />));
    const t = MESSAGES[locale].Lens;
    expect(html).toContain(t.whatThisIs);
    expect(html).toContain(seen.subject);
    expect(html).toContain(t.whatItMeans);
    expect(html).toContain("A prayer mat is used for prayer");
    expect(html).toContain(t.alsoInPhoto);
    expect(html).toContain(">miswak<");
    expect(html).not.toMatch(/\{\{|\}\}/);
  });

  it("labels the translation of ordinary text as a machine translation", () => {
    const seen = { ...response({}).seen!, kind: "text" as const, subject: "sign", visibleText: { text: "قاعة الصلاة", language: "ar" }, plainTranslation: "Prayer hall" };
    const html = render("en", <LensResult response={response({ seen, row: 3 })} id="lens" onChoose={noop} />);
    expect(html).toContain(en.Lens.textRead);
    expect(html).toContain("قاعة الصلاة");
    expect(html).toContain(en.Lens.machineTranslation);
    expect(html).toContain("Prayer hall");
    expect(html).toContain(en.Lens.disclosure);
  });

  it("never shows a machine translation outside the text rows", () => {
    const seen = { ...response({}).seen!, plainTranslation: "a model's translation" };
    expect(render("en", <LensResult response={response({ seen, row: 4 })} id="lens" onChoose={noop} />)).not.toContain("a model's translation");
  });

  it("adds the product boundary to a food label and never a ruling (row 13)", () => {
    const html = render("ar", <LensResult response={response({ row: 13 })} id="lens" onChoose={noop} />);
    expect(html).toContain(ar.Lens.productNote);
    expect(html).toContain('href="/talk-to-a-specialist"');
  });

  it("neither confirms nor denies a claim (row 15)", () => {
    const seen = { ...response({}).seen!, kind: "document" as const, visibleText: { text: "A claim", language: "en" } };
    const html = decoded(render("en", <LensResult response={response({ seen, row: 15 })} id="lens" onChoose={noop} />));
    expect(html).toContain(en.Lens.claimNote);
  });

  it("names a symbol of another religion in one neutral line (row 16)", () => {
    const seen = { ...response({}).seen!, subject: "church" };
    expect(render("en", <LensResult response={response({ seen, row: 16 })} id="lens" onChoose={noop} />)).toContain("This appears to be: church");
  });
});

describe("Lens cards", () => {
  it.each(CARDS.flatMap((card) => (["ar", "en"] as const).map((locale) => [card, locale] as const)))("the %s card is calm, says why, and offers one next step (%s)", (card, locale) => {
    const html = render(locale, <LensCard card={card} onRetake={noop} />);
    const copy = MESSAGES[locale].Lens.cards[card];
    expect(html).toContain(copy.title);
    expect(decoded(html)).toContain(copy.body);
    expect((html.match(/<(button|a)\b/g) ?? []).length).toBe(1);
    if (card === "unmatched") expect(html).toContain('href="/talk-to-a-specialist"');
  });

  it("names an ordinary object plainly, with nothing invented about it", () => {
    expect(render("en", <LensCard card="nothing" subject="car" onRetake={noop} />)).toContain("This looks like: car");
  });
});

describe("while Lens works", () => {
  it.each(["ar", "en"] as const)("shows the two steps, the current one marked (%s)", (locale) => {
    const html = render(locale, <LensWorking picture={<span />} step={1} />);
    const t = MESSAGES[locale].Lens;
    expect(html).toContain(t.stepRead);
    expect(html).toContain(t.stepSources);
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toContain("lens-scan");
  });
});

describe("the examples", () => {
  it("draws each one as an original illustration with a name in both languages", () => {
    for (const id of EXAMPLES) {
      expect(renderToStaticMarkup(<ExampleArt id={id} word="الصلاة" />)).toContain('aria-hidden="true"');
      expect(en.Lens.examples[id]).toBeTruthy();
      expect(ar.Lens.examples[id]).toBeTruthy();
    }
  });
});

describe("the conversation about a photo", () => {
  const photo = (fields: Partial<LensResponse> = {}): ThreadItem => ({
    kind: "photo",
    key: 1,
    picture: <span>PHOTO</span>,
    thumbnail: <span>THUMB</span>,
    response: response({ seen: { ...response({}).seen!, subject: "prayer mat" }, answer: cited, suggestions: ["What is it made of?"], ...fields }),
  });
  const thread = (locale: Locale, items: ThreadItem[], busy = false) =>
    decoded(render(locale, <LensThread items={items} busy={busy} onAsk={noop} onChoose={noop} onNewThread={noop} onAddPhoto={noop} />));

  it.each(["ar", "en"] as const)("pins the photo, opens with what it is and means, then offers questions and a box to ask (%s)", (locale) => {
    const t = MESSAGES[locale].Lens.conversation;
    const html = thread(locale, [photo()]);
    expect(html.indexOf(t.pinned)).toBeLessThan(html.indexOf("PHOTO"));
    expect(html).toContain("THUMB");
    expect(html).toContain("A prayer mat is used for prayer");
    expect(html).toContain(t.suggestions);
    expect(html).toContain(">What is it made of?</button>");
    expect(html).toContain(t.askLabel);
    expect(html).toContain(t.addPhoto);
    expect(html).toContain(t.newThread);
    expect(html).toContain(MESSAGES[locale].Lens.privacyLine);
  });

  it("shows one reply per turn: what can be seen, then Rafiq's answer, with the next questions", () => {
    const turn: ThreadItem = {
      kind: "turn",
      key: 2,
      question: "What colour is it?",
      reply: { status: "answered", visual: "It is green.", answer: cited, card: null, suggestions: ["Where is it kept?"] },
    };
    const html = thread("en", [photo(), turn]);
    const t = en.Lens.conversation;
    expect(html).toContain("What colour is it?");
    expect(html.indexOf(t.seeing)).toBeLessThan(html.indexOf("It is green."));
    expect(html).toContain(">Where is it kept?</button>");
    expect(html).not.toContain(">What is it made of?</button>");
  });

  it("says plainly when a turn asked about people, and while Rafiq is looking", () => {
    const people: ThreadItem = { kind: "turn", key: 2, question: "Who is that?", reply: { status: "answered", visual: null, answer: null, card: "person", suggestions: [] } };
    expect(thread("en", [photo(), people])).toContain(en.Lens.conversation.turnCards.person);
    const waiting: ThreadItem = { kind: "turn", key: 3, question: "And this?", reply: null };
    const html = thread("en", [photo(), waiting], true);
    expect(html).toContain(en.Lens.conversation.thinking);
    expect(html).not.toContain(">What is it made of?</button>");
  });

  it("does not offer a conversation about a photo Lens declined", () => {
    const html = thread("en", [photo({ card: "person", answer: null })]);
    expect(html).toContain(en.Lens.cards.person.title);
    expect(html).not.toContain(en.Lens.conversation.askLabel);
  });

  it("never announces that Lens has finished", () => {
    expect(JSON.stringify(ar.Lens)).not.toContain("انتهت");
  });
});
