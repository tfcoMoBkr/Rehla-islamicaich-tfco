import "server-only";

import type { Locale } from "next-intl";

import type {
  ExchangeView,
  ItemView,
  PartView,
  QuoteView,
  RelatedLesson,
  SituationStop,
  SituationView,
  SourceLabel,
  TestGroup,
} from "@/lib/mawqif/types";

import { evidenceView, lessonHref } from "./lesson-view";
import { transliterate } from "@/lib/mawqif/transliterate";

import { readFetchedHadith, type Khutuwat } from "./load";
import type { Quote, Situation, SituationItem } from "./situation-schema";

/** A final test after every TEST_SIZE situations, and one for the whole section. */
export const TEST_SIZE = 4;

export const situationHref = (id: string): `/${string}` => `/mawqif/${id}`;

async function sourceLabel(item: SituationItem, situation: Situation, locale: Locale): Promise<SourceLabel> {
  if (item.type === "hadith") {
    const fetched = await readFetchedHadith(item.hadeethencId);
    const version = fetched?.languages[locale];
    // HadeethEnc's own attribution, in the page's language.
    return { kind: "hadith", citation: version?.attribution ?? item.citation, grade: version?.grade ?? null, url: version?.url ?? null };
  }
  if (item.type === "quran") {
    const [surah, ayah] = item.ref.split(":");
    return { kind: "quran", ref: item.ref, url: `https://quranenc.com/en/browse/english_saheeh/${surah}#${ayah}` };
  }
  const book = situation.sources.find((source) => source.key === item.source);
  return { kind: "book", title: book ? book.title[locale] : item.source, url: book ? book.url[locale] : "" };
}

export async function toSituationView(situation: Situation, khutuwat: Khutuwat, locale: Locale): Promise<SituationView> {
  const labels = new Map<string, SourceLabel>();
  const items: ItemView[] = [];
  for (const item of situation.items) {
    const source = await sourceLabel(item, situation, locale);
    labels.set(item.id, source);
    items.push({
      id: item.id,
      source,
      evidence: item.type === "book" ? null : await evidenceView(item, locale),
      bookText: item.type === "book" ? item.textRef[locale].excerpt.replace(/\s+/g, " ").trim() : null,
    });
  }
  const quote = (q: Quote): QuoteView => ({
    ref: q.ref,
    // A PDF line break inside a book paragraph is shown as one space, as a browser shows it.
    text: q[locale].replace(/\s+/g, " ").trim(),
    source: labels.get(q.ref)!,
  });
  // A phrase to say carries its Arabic and pronunciation, in every interface language.
  const toSay = (q: Quote): QuoteView => ({
    ...quote(q),
    say: { arabic: q.ar.replace(/\s+/g, " ").trim(), pronunciation: transliterate(q.ar) },
  });
  const part = (p: { text: { ar: string; en: string } } | { quote: Quote }): PartView =>
    "text" in p ? { kind: "text", text: p.text[locale] } : { kind: "quote", quote: quote(p.quote) };

  const exchanges: ExchangeView[] = situation.exchanges.map((exchange) => ({
    id: exchange.id,
    says: exchange.says.map(part),
    keyPoints: exchange.keyPoints.map((point) => ({ id: point.id, quote: toSay(point.quote) })),
    choices: exchange.choices.map((choice) => ({ id: choice.id, quality: choice.quality, reply: choice.reply.map(part), meets: choice.meets })),
  }));

  const related: RelatedLesson[] = situation.relatedLessons.flatMap((id) => {
    const lesson = khutuwat.lessons.get(id);
    return lesson ? [{ id, title: lesson.title[locale], href: lessonHref(lesson) }] : [];
  });

  return {
    id: situation.id,
    order: situation.order,
    reviewed: situation.reviewed,
    title: situation.title[locale],
    art: situation.art,
    scene: situation.scene[locale],
    character: situation.character[locale],
    learn: {
      say: situation.learn.say.map(toSay),
      why: situation.learn.why.map(quote),
      when: situation.learn.when.map(quote),
    },
    items,
    exchanges,
    check: situation.check.map((check, position) => {
      const options = check.options.map((option, index) => ({ id: String(index), part: part(option), correct: option.correct }));
      // A fixed, mixed order: the right answer is not always in the same place.
      const shift = (situation.order + position) % options.length;
      return { id: check.id, prompt: check.prompt[locale], options: [...options.slice(shift), ...options.slice(0, shift)] };
    }),
    related,
  };
}

export function situationStop(situation: Situation, locale: Locale): SituationStop {
  return {
    id: situation.id,
    order: situation.order,
    title: situation.title[locale],
    art: situation.art,
    href: situationHref(situation.id),
    turns: situation.exchanges.map((exchange) => exchange.id),
    checks: situation.check.map((check) => check.id),
  };
}

/** "1", "2", … for each run of TEST_SIZE situations, then "all". */
export function testGroups(situations: readonly Situation[]): TestGroup[] {
  const groups: TestGroup[] = [];
  for (let start = 0; start < situations.length; start += TEST_SIZE) {
    groups.push({ id: String(groups.length + 1), situations: situations.slice(start, start + TEST_SIZE).map((situation) => situation.id) });
  }
  return [...groups, { id: "all", situations: situations.map((situation) => situation.id) }];
}
