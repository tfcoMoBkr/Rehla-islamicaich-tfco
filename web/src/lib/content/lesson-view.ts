import "server-only";

import type { Locale } from "next-intl";

import type {
  ActivityView,
  AyahLine,
  CardView,
  EvidenceView,
  FiqhNoteView,
  GuidedStep,
  LessonSource,
  PublishedTranslation,
  LessonView,
  MediaView,
  QuestionView,
  StationView,
  TermView,
} from "@/lib/learn/types";

import { readFetchedAyah, readFetchedHadith, readFetchedRecitation, readFetchedTerm, type Khutuwat, type StationEntry } from "./load";
import type {
  Activity,
  Bilingual,
  Check,
  Evidence,
  ExcerptRef,
  FiqhEncyclopedia,
  Lesson,
  Media,
  Question,
  Source,
  TextRef,
} from "./schema";

/** `repeat` values on lesson steps that the guided walk knows how to say. */
export const KNOWN_REPEATS = new Set(["once", "onceOnly", "onceRequiredThreeRecommended", "three"]);

export const checkId = (lessonId: string, cardId: string) => `${lessonId}:${cardId}:check`;
export const situationId = (lessonId: string) => `${lessonId}:situation`;
export const lessonHref = (lesson: Pick<Lesson, "station" | "slug">): `/${string}` => `/learn/${lesson.station}/${lesson.slug}`;

type Context = {
  lesson: Lesson;
  locale: Locale;
  sources: Source[];
  lessonSources: LessonSource[];
  issues: string[];
};

const pick = (text: Bilingual, locale: Locale) => text[locale];

type LessonText = { text?: Bilingual; textRef?: TextRef; authoring?: "team" };

/**
 * What a card, step or post-rak'ah line shows: its book excerpts verbatim, or the team's labelled
 * wording. Runs of whitespace (the line breaks a PDF page put inside a paragraph) are shown as one
 * space, as a browser shows them; the characters themselves are not touched.
 */
export function lessonText(item: LessonText, locale: Locale): string | null {
  if (item.textRef) {
    const refs: ExcerptRef[] = ([] as ExcerptRef[]).concat(item.textRef[locale]);
    return refs.map((ref) => ref.excerpt.replace(/\s+/g, " ").trim()).join("\n");
  }
  return item.text ? pick(item.text, locale) : null;
}

const wordingOf = (item: LessonText) => (item.textRef ? "book" : item.text ? "team" : null);

function cardText({ lesson, locale }: Context, cardId: string | undefined): string | undefined {
  const card = cardId ? lesson.cards.find((candidate) => candidate.id === cardId) : undefined;
  return card ? (lessonText(card, locale) ?? undefined) : undefined;
}

/** "21:26-27" → [[21, 26], [21, 27]] */
function expandRef(ref: string): [number, number][] {
  const [surah, range] = ref.split(":");
  const [from, to] = (range ?? "").split("-").map(Number);
  if (!surah || !from) return [];
  return Array.from({ length: (to || from) - from + 1 }, (_, index) => [Number(surah), from + index]);
}

function sourceIdForUrl(url: string, sources: readonly Source[]): string | null {
  const host = (value: string) => new URL(value).hostname.replace(/^www\./, "");
  try {
    const target = host(url);
    return (
      sources.find((source) =>
        [...(source.url ? [source.url] : []), ...source.alsoAt].some((known) => host(known) === target),
      )?.id ?? null
    );
  } catch {
    return null;
  }
}

/** A lesson source is shown only when content/sources.json lists it as approved. */
function lessonSources(context: Context): LessonSource[] {
  return context.lesson.sources.flatMap((source) => {
    const url = pick(source.url, context.locale);
    const sourceId = sourceIdForUrl(url, context.sources);
    if (!sourceId) {
      context.issues.push(`sources.${source.key}: ${url} is not from a source listed in content/sources.json`);
      return [];
    }
    if (!isApproved(sourceId, context.sources)) {
      context.issues.push(`sources.${source.key}: ${sourceId} is not approved, so it is not shown`);
      return [];
    }
    return [{ key: source.key, title: pick(source.title, context.locale), url, sourceId }];
  });
}

export const isApproved = (id: string | null, sources: readonly Source[]) =>
  id !== null && sources.some((source) => source.id === id && source.status === "approved");

/** The books the lesson's cards, steps and post-rak'ah lines actually quote. */
function citedBooks(context: Context): LessonSource[] {
  const { lesson } = context;
  const quoting = [...lesson.cards, ...(lesson.steps ?? []), ...(lesson.afterRakah ?? [])].filter((item) => item.textRef);
  const keys = new Set(quoting.flatMap((item) => item.source ?? []));
  return context.lessonSources.filter((source) => keys.has(source.key));
}

function sourcesFor(keys: readonly string[] | undefined, where: string, context: Context): LessonSource[] {
  return (keys ?? []).flatMap((key) => {
    const found = context.lessonSources.find((source) => source.key === key);
    if (!found) context.issues.push(`${where}: "${key}" is not in the lesson's sources`);
    return found ? [found] : [];
  });
}

const citationOf = (evidence: Evidence | undefined) =>
  evidence ? (evidence.type === "hadith" ? evidence.citation : evidence.ref) : null;

function checkView(check: Check, id: string, lessonId: string, quote: string | null, locale: Locale): QuestionView {
  const common = { id, lessonId, prompt: pick(check.prompt, locale), sourceQuote: quote };
  if (check.type === "trueFalse") return { ...common, type: "trueFalse", answer: check.answer };
  const options = check.options.map((option, index) => ({ id: String(index), text: pick(option, locale) }));
  return { ...common, type: "single", options, answer: String(check.options.findIndex((option) => option.correct)) };
}

export function questionView(question: Question, lessonId: string, quote: string | null, locale: Locale): QuestionView {
  const common = { id: question.id, lessonId, prompt: pick(question.prompt, locale), sourceQuote: quote };
  switch (question.type) {
    case "trueFalse":
    case "single":
      return checkView(question, question.id, lessonId, quote, locale);
    case "multiple":
      return {
        ...common,
        type: "multiple",
        options: question.options.map((option, index) => ({ id: String(index), text: pick(option, locale) })),
        answers: question.options.flatMap((option, index) => (option.correct ? [String(index)] : [])),
      };
    case "order":
      return {
        ...common,
        type: "order",
        items: [...question.items].sort((a, b) => a.n - b.n).map((item) => ({ id: String(item.n), text: pick(item, locale) })),
      };
    case "match":
      return {
        ...common,
        type: "match",
        pairs: question.pairs.map((pair, index) => ({
          id: String(index),
          left: pick(pair.left, locale),
          right: pick(pair.right, locale),
        })),
      };
    case "sort":
      return {
        ...common,
        type: "sort",
        groups: question.groups.map((group) => ({ id: group.key, label: pick(group.label, locale) })),
        items: question.items.map((item, index) => ({ id: String(index), text: pick(item, locale), group: item.group })),
      };
  }
}

/** Media is shown only when its source address belongs to an approved source. */
export function mediaView(media: readonly Media[] | undefined, locale: Locale, sources: readonly Source[]): MediaView[] {
  const approved = (media ?? []).filter((item) => isApproved(sourceIdForUrl(item.sourceUrl, sources), sources));
  return approved.map((item) => {
    const common = { alt: pick(item.alt, locale), credit: item.credit, sourceUrl: item.sourceUrl, licence: item.licence };
    return item.type === "image"
      ? { ...common, kind: "image", src: `/media/${item.src}` }
      : { ...common, kind: "video", youtubeId: item.youtubeId };
  });
}

export async function evidenceView(evidence: Evidence, locale: Locale): Promise<EvidenceView> {
  if (evidence.type === "hadith") {
    const fetched =
      evidence.hadeethencId && evidence.availableIn.includes(locale) ? await readFetchedHadith(evidence.hadeethencId) : null;
    const version = fetched?.languages[locale];
    return {
      kind: "hadith",
      citation: evidence.citation,
      hadith: version
        ? {
            title: version.title,
            text: version.hadeeth,
            grade: version.grade,
            attribution: version.attribution,
            explanation: version.explanation,
            url: version.url,
            fetchedOn: version.fetchedOn,
          }
        : null,
    };
  }

  const refs = expandRef(evidence.ref);
  const [fetched, recitation] = await Promise.all([
    Promise.all(refs.map(([surah, ayah]) => readFetchedAyah(surah, ayah))),
    refs[0] ? readFetchedRecitation(refs[0][0]) : null,
  ]);
  const ayahs = fetched.flatMap((ayah) => {
    if (!ayah) return [];
    const number = Number(ayah.ref.split(":")[1]);
    const timing = recitation?.ayahs.find((candidate) => candidate.ayah === number);
    return [
      {
        ref: ayah.ref,
        arabic: ayah.arabic,
        // Arabic readers read the verse itself; English readers also get the approved translation.
        translation: locale === "en" ? ayah.translations.en.text : null,
        footnotes: locale === "en" ? ayah.translations.en.footnotes : null,
        recitation: recitation && timing ? { audioUrl: recitation.audioUrl, start: timing.start, end: timing.end } : null,
      },
    ];
  });
  const first = fetched.find((ayah) => ayah !== null);
  const translation = first?.translations.en;
  return {
    kind: "quran",
    ref: evidence.ref,
    ayahs,
    url: first?.source.url ?? null,
    attribution: first ? "QuranEnc.com" : null,
    translation:
      locale === "en" && translation
        ? { name: translation.name ?? translation.key, key: translation.key, version: translation.version }
        : null,
    reciter: recitation?.reciter ?? null,
  };
}

async function cardView(card: Lesson["cards"][number], context: Context): Promise<CardView> {
  const { lesson, locale } = context;
  const text = lessonText(card, locale);
  return {
    id: card.id,
    text,
    wording: wordingOf(card),
    sources: sourcesFor(card.source, `cards.${card.id}.source`, context),
    evidence: card.evidence ? await evidenceView(card.evidence, locale) : null,
    evidenceFirst: card.display === "evidenceFirst",
    terms: await termViews(card, context),
    check: card.check ? checkView(card.check, checkId(lesson.id, card.id), lesson.id, text, locale) : null,
    media: mediaView(card.media, locale, context.sources),
  };
}

async function termViews(card: Lesson["cards"][number], context: Context): Promise<TermView[]> {
  const views = await Promise.all(
    (card.terms ?? []).map(async (term): Promise<TermView | null> => {
      const stored = await readFetchedTerm(term.terminologyencId);
      const page = stored?.languages[context.locale];
      const field = (name: string) => page?.fields.find((candidate) => candidate.field === name)?.text ?? null;
      if (!stored || !page) {
        context.issues.push(`cards.${card.id}.terms: term ${term.terminologyencId} is not stored (run scripts/fetch-content.mjs --lesson-terms)`);
        return null;
      }
      return {
        id: stored.id,
        word: pick(term.word, context.locale),
        title: field("title") ?? pick(term.word, context.locale),
        definition: field("idio_def"),
        explanation: field("brief_expl"),
        url: page.url,
      };
    }),
  );
  return views.filter((view) => view !== null);
}

function guidedSteps(keys: string[], context: Context): GuidedStep[] {
  const { lesson, locale } = context;
  return keys.flatMap((key): GuidedStep[] => {
    if (key === "steps") {
      return (lesson.steps ?? []).map((step) => {
        if (step.repeat && !KNOWN_REPEATS.has(step.repeat)) {
          context.issues.push(`steps[${step.n}].repeat: "${step.repeat}" has no label`);
        }
        return {
          id: `step-${step.n}`,
          title: pick(step.title, locale),
          text: lessonText(step, locale) ?? "",
          wording: wordingOf(step),
          repeat: step.repeat ?? null,
          say: step.say ?? null,
          citation: citationOf(step.evidence),
          media: mediaView(step.media, locale, context.sources),
        };
      });
    }
    if (key === "afterRakah") {
      return (lesson.afterRakah ?? []).map((step) => ({
        id: `after-${step.key}`,
        title: null,
        text: lessonText(step, locale) ?? "",
        wording: wordingOf(step),
        repeat: null,
        say: null,
        citation: citationOf(step.evidence),
        media: [],
      }));
    }
    context.issues.push(`guided: no lesson list called "${key}"`);
    return [];
  });
}

type AyahLines = { lines: AyahLine[]; audioUrl: string | null; reciter: string | null; published: PublishedTranslation | null };

/**
 * The ayahs of an ayah-by-ayah reading, each with its published meaning: التفسير الميسر on Arabic
 * pages, the English translation with its footnotes on English pages, both as QuranEnc gives them.
 */
async function ayahLines(context: Context, withAudio: boolean): Promise<AyahLines> {
  const { lesson, locale } = context;
  const ayat = lesson.ayat ?? [];
  const surah = ayat[0] ? Number(ayat[0].ref.split(":")[0]) : null;
  const recitation = withAudio && surah ? await readFetchedRecitation(surah) : null;
  if (withAudio && surah && !recitation) context.issues.push(`ayahByAyah: recitation for surah ${surah} not fetched yet`);

  let published: PublishedTranslation | null = null;
  const lines = await Promise.all(
    ayat.map(async (entry) => {
      const [surahNumber = 0, ayahNumber = 0] = entry.ref.split(":").map(Number);
      const fetched = await readFetchedAyah(surahNumber, ayahNumber);
      if (!fetched) context.issues.push(`ayat ${entry.ref}: not fetched yet (run scripts/fetch-content.mjs)`);
      const shown = locale === "ar" ? fetched?.translations.ar : fetched?.translations.en;
      published ??= shown ? { name: shown.name ?? shown.key, key: shown.key, version: shown.version } : null;
      const meaning = locale === "ar" ? (shown?.text ?? null) : null;
      const translation = locale === "en" ? (shown?.text ?? null) : null;
      if (!meaning && !translation) context.issues.push(`ayat ${entry.ref}: no published meaning in ${locale}`);
      const timing = recitation?.ayahs.find((candidate) => candidate.ayah === ayahNumber);
      return {
        id: entry.ref,
        ref: entry.ref,
        text: fetched?.arabic ?? "",
        meaning,
        translation,
        footnotes: locale === "en" ? (fetched?.translations.en.footnotes ?? null) : null,
        audio: timing ? { start: timing.start, end: timing.end } : undefined,
      };
    }),
  );
  return {
    lines: lines.filter((line) => line.text),
    audioUrl: recitation?.audioUrl ?? null,
    reciter: recitation?.reciter ?? null,
    published,
  };
}

async function activityView(activity: Activity, context: Context): Promise<ActivityView | null> {
  const { lesson, locale, issues } = context;
  const common = {
    id: activity.id,
    title: pick(activity.title, locale),
    instruction: activity.instruction ? pick(activity.instruction, locale) : null,
  };
  const where = `activities.${activity.id} (${activity.type})`;

  switch (activity.type) {
    case "order": {
      if (activity.visual) issues.push(`${where}: visual "${activity.visual}" is not drawn; the steps are shown as text`);
      if (typeof activity.items === "string") {
        if (activity.items !== "steps") {
          issues.push(`${where}: no lesson list called "${activity.items}"`);
          return null;
        }
        const steps = lesson.steps ?? [];
        const order = activity.correctOrder ?? steps.map((step) => step.n).sort((a, b) => a - b);
        return {
          ...common,
          type: "order",
          items: order.flatMap((n) => {
            const step = steps.find((candidate) => candidate.n === n);
            return step ? [{ id: String(n), text: pick(step.title, locale), sourceQuote: lessonText(step, locale) ?? undefined }] : [];
          }),
        };
      }
      return {
        ...common,
        type: "order",
        items: [...activity.items].sort((a, b) => a.n - b.n).map((item) => ({ id: String(item.n), text: pick(item, locale) })),
      };
    }
    case "timeline":
      return {
        ...common,
        type: "timeline",
        items: [...activity.items]
          .sort((a, b) => a.n - b.n)
          .map((item) => ({ id: String(item.n), text: pick(item, locale), label: item.year })),
      };
    case "sort": {
      const groups = activity.groups.map((group) => ({ id: group.key, label: pick(group.label, locale) }));
      const items = activity.items
        ? activity.items.map((item, index) => ({
            id: String(index),
            text: pick(item, locale),
            group: item.group,
            sourceQuote: cardText(context, item.card),
          }))
        : activity.groups.flatMap((group) =>
            (group.steps ?? []).flatMap((n) => {
              const step = lesson.steps?.find((candidate) => candidate.n === n);
              return step
                ? [{ id: `${group.key}-${n}`, text: pick(step.title, locale), group: group.key, sourceQuote: lessonText(step, locale) ?? undefined }]
                : [];
            }),
          );
      return { ...common, type: "sort", groups, items };
    }
    case "swipe":
      return {
        ...common,
        type: "swipe",
        left: pick(activity.sides.left, locale),
        right: pick(activity.sides.right, locale),
        items: activity.items.map((item, index) => ({ id: String(index), text: pick(item, locale), side: item.side })),
      };
    case "select": {
      if (activity.mode === "cases") {
        return {
          ...common,
          type: "selectCases",
          cases: (activity.cases ?? []).map((entry, index) => ({
            id: String(index),
            prompt: pick(entry.prompt, locale),
            options: entry.options,
            answer: entry.answer,
          })),
        };
      }
      const visual = activity.visual === "fiveLanterns" || activity.visual === "collect" ? activity.visual : "plain";
      if (activity.visual && visual === "plain") issues.push(`${where}: visual "${activity.visual}" is not known`);
      return {
        ...common,
        type: "select",
        visual,
        items: (activity.items ?? []).map((item, index) => ({ id: String(index), text: pick(item, locale), correct: item.correct })),
        feedbackWrong: activity.feedbackWrong ? pick(activity.feedbackWrong, locale) : null,
      };
    }
    case "match": {
      if (activity.items === "ayat") {
        const excluded = new Set(activity.exclude ?? []);
        const pairs = await Promise.all(
          (lesson.ayat ?? [])
            .filter((entry) => !excluded.has(entry.ref))
            .map(async (entry) => {
              const [surah = 0, ayah = 0] = entry.ref.split(":").map(Number);
              const fetched = await readFetchedAyah(surah, ayah);
              const meaning = (locale === "ar" ? fetched?.translations.ar : fetched?.translations.en)?.text ?? null;
              if (!fetched || !meaning) {
                issues.push(`${where}: ayah ${entry.ref} has no fetched text or no meaning`);
                return null;
              }
              return { id: entry.ref, left: fetched.arabic, right: meaning };
            }),
        );
        return {
          ...common,
          type: "match",
          pairs: pairs.filter((pair) => pair !== null),
          repeatedRight: false,
          leftIsQuran: true,
        };
      }
      return {
        ...common,
        type: "match",
        pairs: (activity.pairs ?? []).map((pair, index) => ({
          id: String(index),
          left: pick(pair.left, locale),
          right: pick(pair.right, locale),
          sourceQuote: cardText(context, pair.card),
        })),
        repeatedRight: activity.allowRepeatedRight ?? false,
        leftIsQuran: false,
      };
    }
    case "checklist":
      return {
        ...common,
        type: "checklist",
        quiz: activity.mode === "quiz",
        items: activity.items.map((item, index) => ({ id: String(index), text: pick(item, locale), correct: item.correct ?? null })),
      };
    case "reflection":
      if (activity.items !== "cards") {
        issues.push(`${where}: reflection can only offer the lesson's cards`);
        return null;
      }
      return {
        ...common,
        type: "reflection",
        items: lesson.cards.flatMap((card) => {
          const text = lessonText(card, locale);
          return text ? [{ id: card.id, text }] : [];
        }),
      };
    case "guided":
      return {
        ...common,
        type: "guided",
        note: activity.note ? pick(activity.note, locale) : null,
        steps: guidedSteps(Array.isArray(activity.items) ? activity.items : [activity.items], context),
      };
    case "decisionPath":
      return {
        ...common,
        type: "decisionPath",
        steps: activity.steps.map((step, index) => ({
          id: String(index),
          question: pick(step.q, locale),
          yes: step.yes ? pick(step.yes, locale) : null,
          no: step.no ? pick(step.no, locale) : null,
        })),
        end: pick(activity.end, locale),
        sources: sourcesFor(activity.source ? [activity.source] : [], where, context),
      };
    case "dayArc":
      if (activity.items !== "prayers") {
        issues.push(`${where}: no lesson list called "${activity.items}"`);
        return null;
      }
      if (activity.markers?.length) {
        issues.push(`${where}: markers (${activity.markers.join(", ")}) are not linked to the prayers, so they are not drawn on the arc`);
      }
      return {
        ...common,
        type: "dayArc",
        stops: (lesson.prayers ?? []).map((prayer) => ({
          id: prayer.key,
          label: pick(prayer.name, locale),
          detail: pick(prayer.time, locale),
          count: prayer.rakahs,
        })),
      };
    case "ayahByAyah": {
      const { lines, audioUrl, reciter, published } = await ayahLines(context, activity.audio === "mp3quran.net");
      return {
        ...common,
        type: "ayahByAyah",
        ayahs: { lines, audioUrl, reciter, published, attribution: lines.length > 0 ? "QuranEnc.com" : null },
      };
    }
  }
}

/** The fixed line under a fiqh lesson's title, naming only the books the lesson quotes. */
function fiqhNote(lesson: Lesson, books: LessonSource[], encyclopedia: FiqhEncyclopedia): FiqhNoteView | null {
  const sections = encyclopedia.lessons[lesson.id];
  if (!sections) return null;
  return {
    books: books.map((book) => book.title),
    links: sections.map((section) => encyclopedia.url.replace("{section}", String(section))),
  };
}

export async function toLessonView(
  lesson: Lesson,
  khutuwat: Khutuwat,
  locale: Locale,
  sources: Source[],
  encyclopedia: FiqhEncyclopedia,
): Promise<LessonView> {
  const context: Context = { lesson, locale, sources, lessonSources: [], issues: [] };
  context.lessonSources = lessonSources(context);
  const books = citedBooks(context);

  const video = lesson.suggestedVideo[locale];
  const videoSource = video ? sources.find((source) => source.id === video.source) : undefined;
  if (video && !videoSource) context.issues.push(`suggestedVideo.${locale}: "${video.source}" is not in content/sources.json`);
  const showVideo = video && videoSource && videoSource.status === "approved" ? { video, videoSource } : null;

  const cards = await Promise.all(lesson.cards.map((card) => cardView(card, context)));
  const activities = (await Promise.all(lesson.activities.map((activity) => activityView(activity, context)))).filter(
    (activity) => activity !== null,
  );

  return {
    id: lesson.id,
    slug: lesson.slug,
    stationId: lesson.station,
    title: pick(lesson.title, locale),
    demo: lesson.status === "demo",
    objectives: lesson.objectives[locale],
    sources: books,
    fiqhNote: fiqhNote(lesson, books, encyclopedia),
    media: mediaView(lesson.media, locale, sources),
    video: showVideo
      ? {
          id: showVideo.videoSource.id,
          name: pick(showVideo.videoSource.name, locale),
          page: showVideo.video.page,
          file: showVideo.video.file,
          position: showVideo.video.position,
        }
      : null,
    cards,
    activities,
    situation: lesson.situation && {
      question: checkView(
        { type: "single", prompt: lesson.situation.prompt, options: lesson.situation.options },
        situationId(lesson.id),
        lesson.id,
        null,
        locale,
      ),
      followUp: lesson.situation.followUp ? pick(lesson.situation.followUp, locale) : null,
      sources: sourcesFor(lesson.situation.source, "situation.source", context),
    },
    quiz: (lesson.quiz ?? []).map((question) => questionView(question, lesson.id, cardText(context, question.card) ?? null, locale)),
    readMore: lesson.readMore.map((link) => pick(link, locale)),
    laterTopics: (lesson.laterTopics ?? []).map((entry) => {
      const target = khutuwat.lessons.get(entry.lesson);
      return { topic: pick(entry.topic, locale), number: entry.lesson, href: target ? lessonHref(target) : null };
    }),
    issues: context.issues,
  };
}

/** The questions of a lesson that can come back later as Provisions or exam review. */
export function lessonQuestions(lesson: Lesson, locale: Locale): QuestionView[] {
  const checks = lesson.cards.flatMap((card) =>
    card.check ? [checkView(card.check, checkId(lesson.id, card.id), lesson.id, lessonText(card, locale), locale)] : [],
  );
  const situation = lesson.situation
    ? [
        checkView(
          { type: "single", prompt: lesson.situation.prompt, options: lesson.situation.options },
          situationId(lesson.id),
          lesson.id,
          null,
          locale,
        ),
      ]
    : [];
  const quiz = (lesson.quiz ?? []).map((question) => {
    const quote = question.card ? lesson.cards.find((card) => card.id === question.card) : undefined;
    return questionView(question, lesson.id, quote ? lessonText(quote, locale) : null, locale);
  });
  return [...checks, ...situation, ...quiz];
}

/** How many questions the "what do I know?" check takes from a station's exam. */
const BASELINE_FROM_EXAM = 3;

/**
 * A station's "what do I know?" check and exam. A station whose file lists none of its own takes
 * them from its lessons' own questions: the exam is each lesson's first scored question, and the
 * check before the station is three of those same questions, spread across it, so before and
 * after are measured on the same items. No question is written for this.
 */
export function stationParts(station: StationEntry, lessons: ReadonlyMap<string, Lesson>, locale: Locale): { baseline: QuestionView[]; exam: QuestionView[] } {
  const derived = station.lessonIds.flatMap((id) => {
    const lesson = lessons.get(id);
    const first = lesson ? lessonQuestions(lesson, locale)[0] : undefined;
    return first ? [first] : [];
  });
  const listed = (part: "baseline" | "exam") =>
    station[part].map((question) => {
      const lesson = question.lesson ? lessons.get(question.lesson) : undefined;
      const card = lesson?.cards.find((candidate) => candidate.id === question.card);
      return questionView(question, question.lesson ?? station.id, card ? lessonText(card, locale) : null, locale);
    });
  const exam = station.exam.length > 0 ? listed("exam") : derived;
  const baseline = station.baseline.length > 0 ? listed("baseline") : spread(exam, BASELINE_FROM_EXAM);
  return { baseline, exam };
}

/** `count` items from the first to the last, evenly apart. */
function spread<T>(items: readonly T[], count: number): T[] {
  if (items.length <= count) return [...items];
  const positions = Array.from({ length: count }, (_, index) => Math.round((index * (items.length - 1)) / (count - 1)));
  return [...new Set(positions)].map((position) => items[position]!);
}

export function toStationView(station: StationEntry, lessons: ReadonlyMap<string, Lesson>, locale: Locale): StationView {
  return {
    id: station.id,
    title: pick(station.title, locale),
    order: station.order,
    demo: station.demo,
    hasBaseline: stationParts(station, lessons, locale).baseline.length > 0,
    hasExam: stationParts(station, lessons, locale).exam.length > 0,
    lessons: station.lessonIds.flatMap((id) => {
      const lesson = lessons.get(id);
      return lesson
        ? [
            {
              id: lesson.id,
              slug: lesson.slug,
              title: pick(lesson.title, locale),
              demo: lesson.status === "demo",
              hasQuiz: (lesson.quiz?.length ?? 0) > 0,
            },
          ]
        : [];
    }),
  };
}
