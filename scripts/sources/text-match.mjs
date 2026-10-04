// Comparing headings across books and languages without changing any stored text: these forms are
// used only to compare, never saved in place of the original.

/** Lower case, no diacritics (Latin or Arabic), no tatweel, one form of alef, punctuation as spaces. */
export function comparable(text) {
  return (text ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ـ/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const ENGLISH_NUMBERS = [
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
];
const ARABIC_ORDINALS = [
  "الاول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر",
  "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر", "السادس عشر", "السابع عشر", "الثامن عشر", "التاسع عشر", "العشرون",
];

/**
 * The number a heading carries as "Lesson N" / «الدرس N», or null. Longest Arabic ordinals are
 * tried first, so «الثاني عشر» is twelve, not two.
 */
export function lessonNumber(heading, language) {
  const text = comparable(heading);
  if (language === "en") {
    const match = /^lesson (\w+)/.exec(text);
    const index = match ? ENGLISH_NUMBERS.indexOf(match[1]) : -1;
    return index >= 0 ? index + 1 : null;
  }
  if (!text.startsWith("الدرس ")) return null;
  const rest = text.slice("الدرس ".length);
  const ordered = ARABIC_ORDINALS.map((ordinal, index) => ({ ordinal, number: index + 1 })).sort((a, b) => b.ordinal.length - a.ordinal.length);
  const found = ordered.find(({ ordinal }) => rest === ordinal || rest.startsWith(`${ordinal} `));
  return found ? found.number : null;
}

/** A phrase matches a heading when it appears in it; "=phrase" only when it is the whole heading. */
export function matches(phrase, heading) {
  const text = comparable(heading);
  if (!text) return false;
  return phrase.startsWith("=") ? text === comparable(phrase.slice(1)) : text.includes(comparable(phrase));
}
