/*
 * View models handed to client components: lesson files resolved to the learner's language
 * (with evidence from content/fetched/), so the browser only receives what it will show.
 */

export type Choice = { id: string; text: string };
export type Group = { id: string; label: string };

type QuestionCommon = {
  id: string;
  lessonId: string;
  prompt: string;
  /** The card text that answers the question, quoted in feedback and review. */
  sourceQuote: string | null;
};

export type QuestionView =
  | (QuestionCommon & { type: "single"; options: Choice[]; answer: string })
  | (QuestionCommon & { type: "multiple"; options: Choice[]; answers: string[] })
  | (QuestionCommon & { type: "trueFalse"; answer: boolean })
  | (QuestionCommon & { type: "order"; items: Choice[] })
  | (QuestionCommon & { type: "match"; pairs: { id: string; left: string; right: string }[] })
  | (QuestionCommon & { type: "sort"; groups: Group[]; items: { id: string; text: string; group: string }[] });

export type SourceLink = { id: string; name: string };

/** A picture or clip added to a lesson, card or step, always with its credit and licence. */
export type MediaView = { alt: string; credit: string; sourceUrl: string; licence: string } & (
  | { kind: "image"; src: string }
  | { kind: "video"; youtubeId: string }
);

/** A span of a real recitation (mp3quran.net), in milliseconds. */
export type RecitationSpan = { audioUrl: string; start: number; end: number };

export type LessonSource = { key: string; title: string; url: string; sourceId: string | null };

export type QuranAyahView = {
  ref: string;
  arabic: string;
  translation: string | null;
  footnotes: string | null;
  recitation: RecitationSpan | null;
};

export type EvidenceView =
  | {
      kind: "quran";
      ref: string;
      /** Empty until scripts/fetch-content.mjs has fetched the verses. */
      ayahs: QuranAyahView[];
      url: string | null;
      attribution: string | null;
      reciter: string | null;
    }
  | {
      kind: "hadith";
      citation: string;
      /** Null when the hadith has no ID or no version in the learner's language: citation only. */
      hadith: { title: string; text: string; grade: string; attribution: string; explanation: string; url: string } | null;
    };

export type CardView = {
  id: string;
  text: string;
  sources: LessonSource[];
  evidence: EvidenceView | null;
  evidenceFirst: boolean;
  check: QuestionView | null;
  media: MediaView[];
};

export type AyahLine = {
  id: string;
  ref: string;
  text: string;
  meaning: string | null;
  translation: string | null;
  /** The translator's notes for the markers in `translation`, verbatim. */
  footnotes: string | null;
  /** Milliseconds into the surah recitation, when audio is available. */
  audio?: { start: number; end: number };
};

export type AyahSet = {
  lines: AyahLine[];
  attribution: string | null;
  audioUrl: string | null;
  reciter: string | null;
};

type ActivityCommon = { id: string; title: string; instruction: string | null };

export type GuidedStep = {
  id: string;
  title: string | null;
  text: string;
  repeat: string | null;
  say: string | null;
  /** The reference of the step's evidence (a hadith citation or a surah:ayah). */
  citation: string | null;
  media: MediaView[];
};

export type ActivityView = ActivityCommon &
  (
    | { type: "order"; items: { id: string; text: string; sourceQuote?: string }[] }
    | { type: "timeline"; items: { id: string; text: string; label?: string }[] }
    | { type: "sort"; groups: Group[]; items: { id: string; text: string; group: string; sourceQuote?: string }[] }
    | { type: "swipe"; left: string; right: string; items: { id: string; text: string; side: "left" | "right" }[] }
    | {
        type: "select";
        visual: "plain" | "fiveLanterns" | "collect";
        items: { id: string; text: string; correct: boolean }[];
        feedbackWrong: string | null;
      }
    | { type: "selectCases"; cases: { id: string; prompt: string; options: string[]; answer: string }[] }
    | {
        type: "match";
        pairs: { id: string; left: string; right: string; sourceQuote?: string }[];
        repeatedRight: boolean;
        /** The left column holds Quran text, set in the Quran typeface. */
        leftIsQuran: boolean;
      }
    | { type: "checklist"; quiz: boolean; items: { id: string; text: string; correct: boolean | null }[] }
    | { type: "reflection"; items: { id: string; text: string }[] }
    | { type: "guided"; note: string | null; steps: GuidedStep[] }
    | {
        type: "decisionPath";
        steps: { id: string; question: string; yes: string | null; no: string | null }[];
        end: string;
        sources: LessonSource[];
      }
    | { type: "dayArc"; stops: { id: string; label: string; detail: string; count: number }[] }
    | { type: "ayahByAyah"; ayahs: AyahSet }
  );

export type VideoView = SourceLink & {
  youtubeId?: string;
  playlistId?: string;
  position: "close" | "beforeActivity";
};

export type LessonView = {
  id: string;
  slug: string;
  stationId: string;
  title: string;
  reviewed: boolean;
  demo: boolean;
  objectives: string[];
  sources: LessonSource[];
  media: MediaView[];
  video: VideoView | null;
  cards: CardView[];
  activities: ActivityView[];
  situation: { question: QuestionView; followUp: string | null; sources: LessonSource[] } | null;
  quiz: QuestionView[];
  readMore: string[];
  laterTopics: { topic: string; number: string; href: string | null }[];
  /** Notes for reviewers from the lesson file; shown only while it awaits review. */
  reviewNotes: string[];
  /** Parts of the lesson file the engine could not render, so a reviewer can see them. */
  issues: string[];
};

/** A scene drawing from content/art/, inline, with its ids prefixed by `prefix`. */
export type SceneView = { name: string; prefix: string; markup: string };

/** The drawing pinned on a lesson's board and how it follows the learner (content/visuals.json). */
export type LessonVisualView = {
  /** More than one scene: they follow each other as the lesson goes on. */
  scenes: SceneView[];
  /** Parts that light up, in order, as the learner advances. */
  reveal: string[];
  /** Parts that fade away as the learner advances. */
  clear: string[];
  /** A part that moves to the place of the step in focus. */
  follow: { part: string; along: string[] } | null;
  ambience: "water" | null;
  /** Mirrored in right-to-left pages (the day's arc runs in the reading direction). */
  mirrorRtl: boolean;
  needsReview: boolean;
};

export type LessonStop = {
  id: string;
  slug: string;
  title: string;
  reviewed: boolean;
  demo: boolean;
  hasQuiz: boolean;
};

export type StationView = {
  id: string;
  title: string;
  order: number;
  demo: boolean;
  lessons: LessonStop[];
  hasBaseline: boolean;
  hasExam: boolean;
};
