import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { NextIntlClientProvider } from "next-intl";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import messages from "../../../messages/en.json";
import { HadithBlockView, QuranBlockView } from "./answer-blocks";

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
