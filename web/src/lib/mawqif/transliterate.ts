/*
 * An approximate pronunciation of fully vowelled Arabic in Latin letters, by fixed rules: each
 * letter and vowel sign maps to Latin, long vowels, doubled consonants and the article are
 * written as they are said, and the last vowel of a phrase is dropped as it is in a pause. It reads
 * the source's own vowel signs and adds none: text without them gets no pronunciation.
 */

const FATHA = "َ";
const DAMMA = "ُ";
const KASRA = "ِ";
const FATHATAN = "ً";
const DAMMATAN = "ٌ";
const KASRATAN = "ٍ";
const SHADDA = "ّ";
const SUKUN = "ْ";
const DAGGER_ALIF = "ٰ";
const MARKS = /[ً-ٰٟۖ-ۭ]/;
const LETTER = /[ء-يٱ]/;

const CONSONANTS: Record<string, string> = {
  ب: "b", ت: "t", ث: "th", ج: "j", ح: "ḥ", خ: "kh", د: "d", ذ: "dh", ر: "r", ز: "z",
  س: "s", ش: "sh", ص: "ṣ", ض: "ḍ", ط: "ṭ", ظ: "ẓ", ع: "ʿ", غ: "gh", ف: "f", ق: "q",
  ك: "k", ل: "l", م: "m", ن: "n", ه: "h", و: "w", ي: "y", ة: "t",
  ء: "ʼ", أ: "ʼ", إ: "ʼ", ؤ: "ʼ", ئ: "ʼ", آ: "ʼā",
}; // prettier-ignore
// Letters that the article «ال» merges into: «السلام» is "as-salām".
const SUN = new Set([..."تثدذرزسشصضطظلن"]);
const VOWELS: Record<string, string> = {
  [FATHA]: "a", [DAMMA]: "u", [KASRA]: "i", [FATHATAN]: "an", [DAMMATAN]: "un", [KASRATAN]: "in",
}; // prettier-ignore
// The share of a word's letters that must carry a sign for the word to count as vowelled.
const VOWELLED = 0.5;

type Cluster = { letter: string; vowel: string; shadda: boolean; sukun: boolean; dagger: boolean };

function clusters(word: string): Cluster[] {
  const found: Cluster[] = [];
  for (const char of word) {
    if (LETTER.test(char)) found.push({ letter: char, vowel: "", shadda: false, sukun: false, dagger: false });
    const last = found.at(-1);
    if (!last || !MARKS.test(char)) continue;
    if (char === SHADDA) last.shadda = true;
    else if (char === SUKUN) last.sukun = true;
    else if (char === DAGGER_ALIF) last.dagger = true;
    else if (VOWELS[char]) last.vowel = VOWELS[char];
  }
  return found;
}

/** A word carries its vowel signs: every word of a phrase must, or no pronunciation is shown. */
function vowelled(part: string): boolean {
  const letters = [...part].filter((char) => LETTER.test(char)).length;
  const marked = [...part].filter((char) => char in VOWELS || char === SUKUN || char === SHADDA || char === DAGGER_ALIF).length;
  return letters > 0 && marked / letters >= VOWELLED;
}

const bare = (word: string) => [...word].filter((char) => LETTER.test(char)).join("").replace(/[ٱأإآ]/g, "ا");

/** The name of God and its common joined forms, said as one word. */
const NAME: Record<string, string> = {
  الله: "Allāh",
  لله: "lillāh",
  والله: "wallāh",
  بالله: "billāh",
  فالله: "fallāh",
  اللهم: "Allāhumma",
};

function word(text: string): string {
  const name = NAME[bare(text)];
  if (name) return name;
  const letters = clusters(text);
  let out = "";
  let skipShadda = false;
  for (let i = 0; i < letters.length; i++) {
    const { letter, vowel, shadda, dagger } = letters[i]!;
    const before = letters[i - 1];
    const next = letters[i + 1];
    // The article: «ال» at the start of the word, or after a one-letter prefix (و، ف، ب، ك).
    const articleAt = i === 0 || (i === 1 && "وفبك".includes(letters[0]!.letter));
    if ((letter === "ا" || letter === "ٱ") && articleAt && !vowel && next?.letter === "ل" && !next.vowel) {
      const after = letters[i + 2];
      if (after && SUN.has(after.letter)) {
        out += `${i === 0 ? "a" : ""}${CONSONANTS[after.letter]}-`;
        skipShadda = true;
      } else out += `${i === 0 ? "a" : ""}l-`;
      i += 1;
      continue;
    }
    // «آ» inside a word, after a, is a long ā written with a madda (as in «إِنَّآ»).
    if (letter === "ا" || letter === "ٱ" || letter === "ى" || (letter === "آ" && i > 0 && before?.vowel === "a")) {
      // Silent after the -an ending; a long ā after a (or when the alif itself carries the a); a
      // connecting alif before a vowelless letter is "i" at the start of a word, silent inside it.
      if (before?.vowel === "an") continue;
      if (next?.sukun && !vowel) out += i === 0 ? "i" : "";
      else if (before?.vowel === "a" && out.endsWith("a")) out = `${out.slice(0, -1)}ā`;
      else if (before && !before.vowel && vowel === "a") out += "ā";
      else if (i === 0) out += vowel || "a";
      continue;
    }
    // A one-letter prefix written without its vowel («و», «ف») is still said with a.
    if (i === 0 && !vowel && !shadda && (letter === "و" || letter === "ف") && next && next.letter !== "ا") {
      out += `${CONSONANTS[letter]}a`;
      continue;
    }
    if (letter === "و" && !vowel && !shadda && before?.vowel === "u" && out.endsWith("u")) {
      out = `${out.slice(0, -1)}ū`;
      continue;
    }
    if (letter === "ي" && !vowel && !shadda && before?.vowel === "i" && out.endsWith("i")) {
      out = `${out.slice(0, -1)}ī`;
      continue;
    }
    let consonant = CONSONANTS[letter] ?? "";
    // A hamza that opens a word is heard as its vowel alone.
    if ((i === 0 || out.endsWith("-")) && consonant.startsWith("ʼ")) consonant = consonant.slice(1);
    if (letter === "ة") consonant = vowel ? "t" : "h";
    out += shadda && !skipShadda ? consonant + consonant : consonant;
    skipShadda = false;
    out += dagger ? "ā" : vowel;
  }
  return out;
}

/** The approximate pronunciation of `arabic`, or null when it does not carry its vowel signs. */
export function transliterate(arabic: string): string | null {
  const parts = arabic.split(/\s+/).filter((part) => LETTER.test(part));
  if (parts.length === 0 || !parts.every((part) => NAME[bare(part)] !== undefined || vowelled(part))) return null;
  const words = arabic
    .replace(/[«»"“”()]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      const punctuation = /[،,:؛؟?!.]$/.exec(part)?.[0] ?? "";
      const said = word(part.replace(/[،,:؛؟?!.]+$/, ""));
      return said + ({ "،": ",", "؛": ";", "؟": "?" }[punctuation] ?? punctuation);
    })
    .filter(Boolean);
  // In a pause the last short vowel, or the -an/-un/-in ending, is not said.
  const last = words.length - 1;
  if (last >= 0) words[last] = words[last]!.replace(/(?:an|un|in|[aiu])([,;?!.]?)$/, "$1");
  return words.join(" ");
}
