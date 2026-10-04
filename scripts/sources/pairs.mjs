// Pairs the Arabic and English editions of a book section by section, using only what both
// editions state: the number a heading carries ("Lesson One" / «الدرس الأول»), or plain order when
// both editions have the same number of sections. Anything else is listed as unpaired, with why,
// rather than guessed.

import path from "node:path";

import { loadBooks, relative } from "./books.mjs";
import { corpusDir, today, writeJson } from "./common.mjs";
import { lessonNumber } from "./text-match.mjs";

export const BOOK_PAIRS = [
  { book: "important-lessons", title: "الدروس المهمة لعامة الأمة / The Important Lessons for the General Ummah", ar: "1871", en: "2842316" },
  { book: "almukhtasar-almufid", title: "المختصر المفيد للمسلم الجديد / New Muslim Guideline", ar: "islamhouse-2831443", en: "byenah-4784" },
  { book: "new-muslim-guide", title: "دليل المسلم الجديد / The New Muslim Guide", ar: "islamhouse-2838873", en: "islamhouse-2838874" },
  { book: "prophet-prayer", title: "كيفية صلاة النبي ﷺ / The Prophet's Manner of Performing Prayer", ar: "62675", en: "1261" },
];

const brief = (section) => ({ anchor: section.anchor, heading: section.heading, file: relative(section.file) });

function pair(ar, en) {
  if (ar.length === 0 || en.length === 0) {
    const missing = [ar.length === 0 && "Arabic", en.length === 0 && "English"].filter(Boolean).join(" and ");
    return { rule: null, pairs: [], reason: `the ${missing} edition has no sections` };
  }
  if (ar.length === en.length) {
    return { rule: "order", pairs: ar.map((section, index) => ({ ar: brief(section), en: brief(en[index]) })), reason: null };
  }
  const numbered = (sections, language) => {
    const byNumber = new Map();
    for (const section of sections) {
      const number = lessonNumber(section.heading, language);
      if (number !== null) byNumber.set(number, [...(byNumber.get(number) ?? []), section]);
    }
    return byNumber;
  };
  const arNumbers = numbered(ar, "ar");
  const enNumbers = numbered(en, "en");
  const pairs = [...arNumbers.keys()]
    .filter((number) => arNumbers.get(number).length === 1 && enNumbers.get(number)?.length === 1)
    .sort((a, b) => a - b)
    .map((number) => ({ lesson: number, ar: brief(arNumbers.get(number)[0]), en: brief(enNumbers.get(number)[0]) }));
  return {
    rule: pairs.length > 0 ? "numbered headings" : null,
    pairs,
    reason: `the editions have ${ar.length} (ar) and ${en.length} (en) sections, so order alone cannot pair them${pairs.length > 0 ? "; only headings that carry the same lesson number are paired" : ", and their headings carry no shared numbering"}`,
  };
}

export async function writePairs() {
  const books = new Map((await loadBooks()).map((book) => [book.id, book]));
  const written = [];
  for (const entry of BOOK_PAIRS) {
    const ar = books.get(entry.ar);
    const en = books.get(entry.en);
    const arSections = ar?.sections ?? [];
    const enSections = en?.sections ?? [];
    const result = pair(arSections, enSections);
    const pairedAr = new Set(result.pairs.map((item) => item.ar.anchor));
    const pairedEn = new Set(result.pairs.map((item) => item.en.anchor));
    const record = {
      book: entry.book,
      title: entry.title,
      editions: {
        ar: { id: entry.ar, url: ar?.url ?? null, sections: arSections.length, ...(ar?.failures.length ? { failures: ar.failures } : {}) },
        en: { id: entry.en, url: en?.url ?? null, sections: enSections.length, ...(en?.failures.length ? { failures: en.failures } : {}) },
      },
      rule: result.rule,
      ...(result.reason ? { note: result.reason } : {}),
      pairs: result.pairs,
      unpaired: {
        ar: arSections.filter((section) => !pairedAr.has(section.anchor)).map(brief),
        en: enSections.filter((section) => !pairedEn.has(section.anchor)).map(brief),
      },
      madeOn: today,
    };
    await writeJson(path.join(corpusDir, "books", "pairs", `${entry.book}.json`), record);
    written.push(record);
  }
  return written;
}
