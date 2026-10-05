import type { SeenInput } from "./lens";

/*
 * Lens examples for a visitor without a camera: what the reading step would report for each
 * drawing, stored here, so a tap runs only the explaining step. Each is marked "example" on screen.
 * Subjects are plain names, not religious content; Rafiq explains them from the approved sources.
 */

export const EXAMPLES = ["mosque", "prayerMat", "wudu", "calligraphy"] as const;
export type ExampleId = (typeof EXAMPLES)[number];

const SUBJECTS: Record<Exclude<ExampleId, "calligraphy">, Record<"ar" | "en", string>> = {
  mosque: { ar: "المسجد", en: "a mosque" },
  prayerMat: { ar: "سجادة الصلاة", en: "a prayer mat" },
  wudu: { ar: "مكان الوضوء", en: "a wudu area" },
};

/** The word drawn in the calligraphy example. */
export const CALLIGRAPHY_WORD = "الصلاة";

export function exampleSeen(id: ExampleId, locale: "ar" | "en"): SeenInput {
  if (id === "calligraphy") {
    return {
      kind: "text",
      subject: locale === "ar" ? "خط عربي" : "Arabic calligraphy",
      visibleText: { text: CALLIGRAPHY_WORD, language: "ar" },
      // A religious term is never machine-translated: Rafiq explains it from the sources instead.
      plainTranslation: null,
      confidence: 1,
      category: "sign",
      religiousTerms: [CALLIGRAPHY_WORD],
    };
  }
  return {
    kind: id === "mosque" ? "place" : "object",
    subject: SUBJECTS[id][locale],
    confidence: 1,
    category: id === "mosque" ? "mosque" : "worship",
  };
}
