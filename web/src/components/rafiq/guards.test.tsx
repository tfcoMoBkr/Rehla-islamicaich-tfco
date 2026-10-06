import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ReferralCentresProvider } from "@/components/specialists/centres-context";
import { rafiqAnswerSchema, type RafiqAnswer } from "@/lib/rafiq/answer";

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

function render(locale: Locale, answer: RafiqAnswer): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      <ReferralCentresProvider value={centres}>
        <AnswerView answer={answer} id="a" onFollowUp={() => undefined} />
      </ReferralCentresProvider>
    </NextIntlClientProvider>,
  ).replaceAll("&#x27;", "'");
}

const answer = (blocks: unknown[], sources: unknown[]): RafiqAnswer =>
  rafiqAnswerSchema.parse({ language: "en", level: "A", referred: false, blocks, sources });

const glossarySource = { n: 1, sourceId: "organisers-glossary", title: "GLOSSARY-TITLE", reference: "7", url: "", publisher: "GLOSSARY-TITLE" };
const termSource = { n: 2, sourceId: "terminologyenc", title: "TERM", reference: "#1", url: "https://terminologyenc.com/en/browse/term/1", publisher: "TerminologyEnc.com" };
const book = { n: 1, sourceId: "s", title: "Book", reference: "1", url: "https://example.org", publisher: "P" };

describe("a term translated from the organisers' glossary", () => {
  it.each(["ar", "en"] as const)("shows the approved equivalent first, then the usage rule and the definition (%s)", (locale) => {
    const term = { type: "term", n: 1, term: "TERM-AR", approved: "APPROVED-FORM", rule: "USAGE-RULE", definition: "DEFINITION", definitionLanguage: "en", definitionN: 2 };
    const html = render(locale, answer([term], [glossarySource, termSource]));
    const t = MESSAGES[locale].Rafiq.term;
    expect(html.indexOf(t.equivalent)).toBeLessThan(html.indexOf("APPROVED-FORM"));
    expect(html.indexOf("APPROVED-FORM")).toBeLessThan(html.indexOf("USAGE-RULE"));
    expect(html.indexOf("USAGE-RULE")).toBeLessThan(html.indexOf("DEFINITION"));
    expect(html).toContain(t.rule);
    expect(html).toContain(t.definition);
  });

  it("links a source with no public address only to its entry on the sources page", () => {
    const html = render("en", answer([{ type: "term", n: 1, term: "T", approved: "A", rule: "R" }], [glossarySource]));
    expect(html).toContain('href="/sources#organisers-glossary"');
    expect(html).not.toContain('href=""');
  });
});

describe("a hadith whose grade the source does not state", () => {
  it.each(["ar", "en"] as const)("says so after a quote no entry matched, and on a block with no grade (%s)", (locale) => {
    const line = MESSAGES[locale].Rafiq.gradeNotStated;
    const quoted = answer([{ type: "text", text: "QUOTED [1]." }, { type: "note", note: "gradeNotStated" }], [book]);
    const html = render(locale, quoted);
    expect(html.indexOf("QUOTED")).toBeLessThan(html.indexOf(line));

    const ungraded = { type: "hadith", n: 1, id: 1, title: "", arabic: "ARABIC", text: "TEXT", textLanguage: "en", grade: "", attribution: "", url: "https://hadeethenc.com/en/browse/hadith/1" };
    expect(render(locale, answer([ungraded], [book]))).toContain(line);
    const graded = { ...ungraded, grade: "GRADE" };
    expect(render(locale, answer([graded], [book]))).not.toContain(line);
  });
});

describe("a verse the learner quoted in other words", () => {
  it.each(["ar", "en"] as const)("is followed by the fixed line that the wording differs (%s)", (locale) => {
    const verse = { type: "quran", n: 1, ref: "2:256", surah: 2, ayah: 256, arabic: "ARABIC", url: "https://quranenc.com/en/browse/english_saheeh/2#256" };
    const html = render(locale, answer([verse, { type: "note", note: "wordingDiffers" }], [book]));
    expect(html.indexOf("ARABIC")).toBeLessThan(html.indexOf(MESSAGES[locale].Rafiq.wordingDiffers));
  });
});

describe("a book passage and the line beside a question about one's own situation", () => {
  it.each(["ar", "en"] as const)("shows the passage verbatim, labelled with its own language, then the fixed line (%s)", (locale) => {
    const passage = { type: "book", n: 1, title: "Book", reference: "q7", text: "PASSAGE-TEXT", language: "ar", url: "https://dawa.center/file/7937" };
    const html = render(locale, answer([passage, { type: "note", note: "notARuling" }], [book]));
    const t = MESSAGES[locale].Rafiq;
    expect(html).toContain("PASSAGE-TEXT");
    expect(html).toContain(t.book.fromSourceIn.split("{")[0]);
    expect(html.indexOf("PASSAGE-TEXT")).toBeLessThan(html.indexOf(t.notARuling));
  });
});

