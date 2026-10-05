import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { NextIntlClientProvider } from "next-intl";
import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { RafiqAnswer } from "@/lib/rafiq/answer";

import ar from "../../../messages/ar.json";
import messages from "../../../messages/en.json";
import { HadithBlockView, QuranBlockView } from "./answer-blocks";
import { AnswerView } from "./answer-view";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

// next/font runs only in a Next build; the answer's font classes do not matter here.
vi.mock("@/lib/answer-fonts", () => ({ ANSWER_FONT_VARIABLES: { ar: "", en: "", ur: "", bn: "", fr: "" } }));

const fetched = path.resolve(__dirname, "../../../../content/fetched");

function stored<T>(kind: string, name: string): T {
  return JSON.parse(readFileSync(path.join(fetched, kind, name), "utf8")) as T;
}

function render(element: ReactElement): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages}>
      {element}
    </NextIntlClientProvider>,
  );
}

/** The text of each element marked as a published text of this kind, as the browser will read it. */
function published(html: string, kind: string): string[] {
  const pattern = new RegExp(`data-published="${kind}"[^>]*>([\\s\\S]*?)</p>`, "g");
  return [...html.matchAll(pattern)].map((match) =>
    match[1]
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&quot;", '"')
      .replaceAll("&#x27;", "'")
      .replaceAll("&amp;", "&"),
  );
}

type StoredHadith = { languages: Record<string, { hadeeth: string; title: string; grade: string; attribution: string; explanation: string; url: string }> };
type StoredVerse = { arabic: string; translations: { en: { key: string; version: string; text: string } }; source: { url: string } };

describe("published texts reach the page unchanged", () => {
  const hadithFile = readdirSync(path.join(fetched, "hadith")).find((name) => name.endsWith(".json"))!;
  const hadith = stored<StoredHadith>("hadith", hadithFile);
  const verseFile = readdirSync(path.join(fetched, "quran")).find((name) => name.endsWith(".json"))!;
  const verse = stored<StoredVerse>("quran", verseFile);

  it("shows a hadith's Arabic, translation and explanation byte for byte, however long", () => {
    const { ar, en } = hadith.languages;
    const html = render(
      createElement(HadithBlockView, {
        block: {
          type: "hadith",
          n: 1,
          id: Number.parseInt(hadithFile, 10),
          title: en.title,
          arabic: ar.hadeeth,
          text: en.hadeeth,
          textLanguage: "en",
          grade: en.grade,
          attribution: en.attribution,
          explanation: en.explanation,
          url: en.url,
        },
        id: "a",
        language: "en",
      }),
    );

    expect(published(html, "arabic")).toEqual([ar.hadeeth]);
    expect(published(html, "translation")).toEqual([en.hadeeth]);
    expect(published(html, "explanation")).toEqual([en.explanation]);
    expect(Buffer.from(published(html, "arabic")[0])).toEqual(Buffer.from(ar.hadeeth));
  });

  it("shows a verse's Arabic and translation byte for byte", () => {
    const [surah, ayah] = verseFile.replace(".json", "").split("-").map(Number);
    const html = render(
      createElement(QuranBlockView, {
        block: {
          type: "quran",
          n: 1,
          ref: `${surah}:${ayah}`,
          surah,
          ayah,
          surahName: "Name",
          arabic: verse.arabic,
          translation: verse.translations.en.text,
          translationLanguage: "en",
          translationKey: verse.translations.en.key,
          translationName: "English Translation",
          translationVersion: verse.translations.en.version,
          url: verse.source.url,
        },
        id: "a",
        language: "en",
      }),
    );

    expect(Buffer.from(published(html, "arabic")[0])).toEqual(Buffer.from(verse.arabic));
    expect(Buffer.from(published(html, "translation")[0])).toEqual(Buffer.from(verse.translations.en.text));
  });

  it("labels a translation shown in another language than the answer", () => {
    const { ar, en } = hadith.languages;
    const html = render(
      createElement(HadithBlockView, {
        block: { type: "hadith", n: 1, id: 1, title: "", arabic: ar.hadeeth, text: en.hadeeth, textLanguage: "en", grade: "", attribution: "", url: en.url },
        id: "a",
        language: "bn",
      }),
    );

    expect(html).toContain("HadeethEnc has no Bangla version of this hadith; the English one is shown.");
    expect(html).toMatch(/lang="en" dir="ltr" data-published="translation"/);
  });
});

describe("the learner's name in a reply", () => {
  const reply = (language: "ar" | "en", opening: string, followUp: string): RafiqAnswer => ({
    kind: "answer",
    language,
    level: "A",
    referred: false,
    opening,
    followUp,
    blocks: [{ type: "text", text: language === "ar" ? "تغسل وجهك {{name}} [1]." : "You wash your face {{name}} [1]." }],
    sources: [{ n: 1, sourceId: "s", title: "Book", reference: "1", url: "https://example.org", publisher: "P" }],
    referral: null,
    laterLessonId: null,
    languageFallback: false,
  });

  it.each([
    ["en", reply("en", "Good question, {{name}}.", "{{name}}, was that clear?"), "Good question.", "Was that clear?"],
    ["ar", reply("ar", "سؤال جميل يا {{name}}.", "يا {{name}}، هل كان ذلك واضحًا؟"), "سؤال جميل.", "هل كان ذلك واضحًا؟"],
  ] as const)("never shows the placeholder, and leaves cleanly without a name (%s)", (locale, answer, opening, followUp) => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={locale === "ar" ? ar : messages}>
        <AnswerView answer={answer} id="a" />
      </NextIntlClientProvider>,
    );
    expect(html).not.toMatch(/\{\{|\}\}/);
    expect(html).toContain(opening);
    expect(html).toContain(followUp);
  });
});
