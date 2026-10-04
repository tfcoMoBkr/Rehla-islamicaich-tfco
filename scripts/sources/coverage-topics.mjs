// For docs/COVERAGE.md and the lessonIds of Rafiq's index: for each lesson, the phrases that mark a
// book section or a hadith category as covering its topic. The phrases live in
// coverage-topics.json, read here and by the AI service's ingest (through content/corpus/coverage.json).
// A phrase matches a heading or a category title (ar or en) when it appears in it; "=phrase" only
// when it is the whole title. Matching ignores case, diacritics, tatweel and alef forms
// (scripts/sources/text-match.mjs). These are search phrases written for the report, not lesson
// content; the report lists every match so a reviewer can check each one.

import topics from "./coverage-topics.json" with { type: "json" };

/** @type {Record<string, { ar: string[]; en: string[] }>} */
export const COVERAGE_TOPICS = topics;
