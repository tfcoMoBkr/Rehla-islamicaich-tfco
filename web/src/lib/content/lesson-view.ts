import "server-only";

import type { Locale } from "next-intl";

import type {
  ActivityView,
  AyahLine,
  CardView,
  EvidenceView,
  GuidedStep,
  LessonSource,
  LessonView,
  QuestionView,
  StationView,
} from "@/lib/learn/types";

import { readFetchedAyah, readFetchedHadith, readFetchedRecitation, type Khutuwat, type StationEntry } from "./load";
import type { Activity, Bilingual, Check, Evidence, Lesson, Question, Source } from "./schema";

/** `repeat` values on lesson steps that the guided walk knows how to say. */
export const KNOWN_REPEATS = new Set(["once", "onceOnly", "onceRequiredThreeRecommended", "three"]);

export const checkId = (lessonId: string, cardId: string) => `${lessonId}:${cardId}:check`;
export const situationId = (lessonId: string) => `${lessonId}:situation`;
export const lessonHref = (lesson: Pick<Lesson, "station" | "slug">) => `/learn/${lesson.station}/${lesson.slug}`;

type Context = {
  lesson: Lesson;
  locale: Locale;
  sources: Source[];
  lessonSources: LessonSource[];
  issues: string[];
};

const pick = (text: Bilingual, locale: Locale) => text[locale];

function cardText({ lesson, locale }: Context, cardId: string | undefined): string | undefined {
  const card = cardId ? lesson.cards.find((candidate) => candidate.id === cardId) : undefined;
  return card ? pick(card.text, locale) : undefined;
}

/** "21:26-27" → [[21, 26], [21, 27]] */
function expandRef(ref: string): [number, number][] {
  const [surah, range] = ref.split(":");
  const [from, to] = (range ?? "").split("-").map(Number);
  if (!surah || !from) return [];
  return Array.from({ length: (to || from) - from + 1 }, (_, index) => [Number(surah), from + index]);
}

function sourceIdForUrl(url: string, sources: Source[]): string | null {
  const host = (value: string) => new URL(value).hostname.replace(/^www\./, "");
  try {
    const target = host(url);
    return sources.find((source) => [source.url, ...source.alsoAt].some((known) => host(known) === target))?.id ?? null;
  } catch {
    return null;
  }
}

function lessonSources(context: Context): LessonSource[] {
  return context.lesson.sources.map((source) => {
    const url = pick(source.url, context.locale);
    const sourceId = sourceIdForUrl(url, context.sources);
    if (!sourceId) context.issues.push(`sources.${source.key}: ${url} is not from a source listed in content/sources.json`);
    return { key: source.key, title: pick(source.title, context.locale), url, sourceId };
  });
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

async function evidenceView(evidence: Evidence, locale: Locale): Promise<EvidenceView> {
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
          }
        : null,
    };
  }

  const fetched = await Promise.all(expandRef(evidence.ref).map(([surah, ayah]) => readFetchedAyah(surah, ayah)));
  const ayahs = fetched.flatMap((ayah) =>
    ayah
      ? [
          {
            ref: ayah.ref,
            arabic: ayah.arabic,
            // Arabic readers read the verse itself; English readers also get the approved translation.
            translation: locale === "en" ? ayah.translations.en.text : null,
            footnotes: locale === "en" ? ayah.translations.en.footnotes : null,
          },
        ]
      : [],
  );
  const first = fetched.find((ayah) => ayah !== null);
  const translation = first?.translations.en;
  return {
    kind: "quran",
    ref: evidence.ref,
    ayahs,
    url: first?.source.url ?? null,
    attribution: first
      ? locale === "en" && translation
        ? `QuranEnc.com · ${translation.key}${translation.version ? ` ${translation.version}` : ""}`
        : "QuranEnc.com"
      : null,
  };
}

async function cardView(card: Lesson["cards"][number], context: Context): Promise<CardView> {
  const { lesson, locale } = context;
  const text = pick(card.text, locale);
  return {
    id: card.id,
    text,
    sources: sourcesFor(card.source, `cards.${card.id}.source`, context),
    evidence: card.evidence ? await evidenceView(card.evidence, locale) : null,
    evidenceFirst: card.display === "evidenceFirst",
    check: card.check ? checkView(card.check, checkId(lesson.id, card.id), lesson.id, text, locale) : null,
  };
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
          text: pick(step.text, locale),
          repeat: step.repeat ?? null,
          say: step.say ?? null,
          citation: citationOf(step.evidence),
        };
      });
    }
    if (key === "afterRakah") {
      return (lesson.afterRakah ?? []).map((step) => ({
        id: `after-${step.key}`,
        title: null,
        text: pick(step.text, locale),
        repeat: null,
        say: null,
        citation: citationOf(step.evidence),
      }));
    }
    context.issues.push(`guided: no lesson list called "${key}"`);
    return [];
  });
}

async function ayahLines(context: Context, withAudio: boolean): Promise<{ lines: AyahLine[]; audioUrl: string | null; reciter: string | null }> {
  const { lesson, locale } = context;
  const ayat = lesson.ayat ?? [];
  const surah = ayat[0] ? Number(ayat[0].ref.split(":")[0]) : null;
  const recitation = withAudio && surah ? await readFetchedRecitation(surah) : null;
  if (withAudio && surah && !recitation) context.issues.push(`ayahByAyah: recitation for surah ${surah} not fetched yet`);

  const lines = await Promise.all(
    ayat.map(async (entry) => {
      const [surahNumber = 0, ayahNumber = 0] = entry.ref.split(":").map(Number);
      const fetched = await readFetchedAyah(surahNumber, ayahNumber);
      if (!fetched) context.issues.push(`ayat ${entry.ref}: not fetched yet (run scripts/fetch-content.mjs)`);
      const meaning = entry.meaning ? pick(entry.meaning, locale) : null;
      const translation = locale === "en" ? (fetched?.translations.en.text ?? null) : null;
      if (!meaning && !translation) context.issues.push(`ayat ${entry.ref}: no meaning in ${locale}`);
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
            return step ? [{ id: String(n), text: pick(step.title, locale), sourceQuote: pick(step.text, locale) }] : [];
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
                ? [{ id: `${group.key}-${n}`, text: pick(step.title, locale), group: group.key, sourceQuote: pick(step.text, locale) }]
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
              const meaning = entry.meaning ? pick(entry.meaning, locale) : null;
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
      return { ...common, type: "reflection", items: lesson.cards.map((card) => ({ id: card.id, text: pick(card.text, locale) })) };
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
      const { lines, audioUrl, reciter } = await ayahLines(context, activity.audio === "mp3quran.net");
      return {
        ...common,
        type: "ayahByAyah",
        ayahs: { lines, audioUrl, reciter, attribution: lines.length > 0 ? "QuranEnc.com" : null },
      };
    }
  }
}

export async function toLessonView(lesson: Lesson, khutuwat: Khutuwat, locale: Locale, sources: Source[]): Promise<LessonView> {
  const context: Context = { lesson, locale, sources, lessonSources: [], issues: [] };
  context.lessonSources = lessonSources(context);

  const video = lesson.suggestedVideo[locale];
  const videoSource = video
    ? sources.find((source) => source.aliases.includes(video.channel) || source.name.ar === video.channel || source.name.en === video.channel)
    : undefined;
  if (video && !videoSource) context.issues.push(`suggestedVideo.${locale}: channel "${video.channel}" is not in content/sources.json`);

  const cards = await Promise.all(lesson.cards.map((card) => cardView(card, context)));
  const activities = (await Promise.all(lesson.activities.map((activity) => activityView(activity, context)))).filter(
    (activity) => activity !== null,
  );

  return {
    id: lesson.id,
    slug: lesson.slug,
    stationId: lesson.station,
    title: pick(lesson.title, locale),
    reviewed: lesson.reviewed,
    demo: lesson.status === "demo",
    objectives: lesson.objectives[locale],
    sources: context.lessonSources,
    video:
      video && videoSource
        ? {
            id: videoSource.id,
            name: pick(videoSource.name, locale),
            youtubeId: video.youtubeId,
            playlistId: video.playlistId,
            position: video.position,
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
    reviewNotes: lesson.reviewed ? [] : (lesson.reviewNotes ?? []),
    issues: context.issues,
  };
}

/** The questions of a lesson that can come back later as Provisions or exam review. */
export function lessonQuestions(lesson: Lesson, locale: Locale): QuestionView[] {
  const checks = lesson.cards.flatMap((card) =>
    card.check ? [checkView(card.check, checkId(lesson.id, card.id), lesson.id, pick(card.text, locale), locale)] : [],
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
    return questionView(question, lesson.id, quote ? pick(quote.text, locale) : null, locale);
  });
  return [...checks, ...situation, ...quiz];
}

export function toStationView(station: StationEntry, lessons: ReadonlyMap<string, Lesson>, locale: Locale): StationView {
  return {
    id: station.id,
    title: pick(station.title, locale),
    order: station.order,
    demo: station.demo,
    hasBaseline: station.baseline.length > 0,
    hasExam: station.exam.length > 0,
    lessons: station.lessonIds.flatMap((id) => {
      const lesson = lessons.get(id);
      return lesson
        ? [
            {
              id: lesson.id,
              slug: lesson.slug,
              title: pick(lesson.title, locale),
              reviewed: lesson.reviewed,
              demo: lesson.status === "demo",
              hasQuiz: (lesson.quiz?.length ?? 0) > 0,
            },
          ]
        : [];
    }),
  };
}
