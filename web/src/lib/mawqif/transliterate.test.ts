import { describe, expect, it } from "vitest";

import { loadSituations } from "@/lib/content/load";

import { transliterate } from "./transliterate";

describe("the approximate pronunciation of a phrase", () => {
  it.each([
    ["السَّلَامُ عَلَيْكُمْ", "as-salāmu ʿalaykum"],
    ["يَرْحَمُكَ الله", "yarḥamuka Allāh"],
    ["اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ", "Allāhumma iftaḥ lī abwāba raḥmatik"],
    ["مَنْ نَسِيَ وَهُوَ صَائِمٌ", "man nasiya wahuwa ṣāʼim"],
    ["إِنَّا لِلَّهِ وَإِنَّآ إِلَيۡهِ رَٰجِعُونَ", "innā lillāh waʼinnā ilayhi rājiʿūn"],
  ])("follows fixed rules from the vowel signs: %s", (arabic, expected) => {
    expect(transliterate(arabic)).toBe(expected);
  });

  it("gives none where the source does not carry its vowel signs", () => {
    expect(transliterate("قم فاركع ركعتين")).toBeNull();
    expect(transliterate("إنَّ لِلَّه ما أَخَذ ولَهُ ما أَعطَى")).toBeNull();
  });

  it("covers every phrase to say in the twelve situations, or says plainly that it cannot", async () => {
    const phrases = (await loadSituations()).flatMap((situation) => situation.learn.say.map((quote) => quote.ar));
    const given = phrases.filter((phrase) => transliterate(phrase) !== null);
    expect(given.length).toBeGreaterThan(phrases.length / 2);
    for (const phrase of given) expect(transliterate(phrase)).not.toMatch(/[؀-ۿ]/);
  });
});
