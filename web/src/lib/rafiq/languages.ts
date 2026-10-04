/**
 * The languages Rafiq answers in, as one table (the AI service's twin is ai/app/languages.py).
 * Adding a language is adding a row here, its font if it needs one, and its messages in
 * messages/answer-languages.json. Interface labels stay in the page's locale (ar or en).
 */
export const ANSWER_LANGUAGES = ["ar", "en", "ur", "bn", "fr"] as const;
export type AnswerLanguage = (typeof ANSWER_LANGUAGES)[number];

type LanguageStyle = {
  dir: "rtl" | "ltr";
  /** Tailwind classes for the script: its face (see globals.css) and a line height that suits it. */
  className: string;
};

export const LANGUAGE_STYLES: Readonly<Record<AnswerLanguage, LanguageStyle>> = {
  ar: { dir: "rtl", className: "font-arabic leading-loose" },
  en: { dir: "ltr", className: "leading-relaxed" },
  ur: { dir: "rtl", className: "font-urdu leading-[2.4]" },
  bn: { dir: "ltr", className: "font-bengali leading-loose" },
  fr: { dir: "ltr", className: "leading-relaxed" },
};

/** `lang`, `dir` and the script's classes for an element holding text in `language`. */
export function inLanguage(language: AnswerLanguage): { lang: string; dir: "rtl" | "ltr"; className: string } {
  const style = LANGUAGE_STYLES[language];
  return { lang: language, dir: style.dir, className: style.className };
}
