import type { EvidenceView } from "@/lib/learn/types";

/*
 * A Mawqif situation as the page shows it, in one language. Every religious item is a QuoteView:
 * exact words of a stored source, with the source they come from. Team wording is TextPart only.
 */

export type SourceLabel =
  | { kind: "hadith"; citation: string; grade: string | null; url: string | null }
  | { kind: "quran"; ref: string; url: string | null }
  | { kind: "book"; title: string; url: string };

/**
 * A phrase the learner is taught to say: its Arabic as the source writes it, and an approximate
 * pronunciation made by fixed rules from its vowel signs (null when the source has none).
 */
export type SayView = { arabic: string; pronunciation: string | null };

export type QuoteView = { ref: string; text: string; source: SourceLabel; say?: SayView };

export type PartView = { kind: "text"; text: string } | { kind: "quote"; quote: QuoteView };

/** A source in full, for "read the whole source" beside its quotes. */
export type ItemView = { id: string; source: SourceLabel; evidence: EvidenceView | null; bookText: string | null };

export type ChoiceView = { id: string; quality: "best" | "acceptable" | "avoid"; reply: PartView[]; meets: string[] };

export type ExchangeView = {
  id: string;
  says: PartView[];
  keyPoints: { id: string; quote: QuoteView }[];
  choices: ChoiceView[];
};

export type SituationCheckView = {
  id: string;
  prompt: string;
  options: { id: string; part: PartView; correct: boolean }[];
};

export type RelatedLesson = { id: string; title: string; href: `/${string}` };

export type SituationView = {
  id: string;
  order: number;
  title: string;
  art: string;
  scene: string;
  character: string;
  learn: { say: QuoteView[]; why: QuoteView[]; when: QuoteView[] };
  items: ItemView[];
  exchanges: ExchangeView[];
  check: SituationCheckView[];
  related: RelatedLesson[];
};

/** A situation on the map: enough to show it as a stop and to work out its progress. */
export type SituationStop = {
  id: string;
  order: number;
  title: string;
  art: string;
  href: `/${string}`;
  turns: string[];
  checks: string[];
};

/** The final tests: one after every few situations, and one for the whole section. */
export type TestGroup = { id: string; situations: string[] };
