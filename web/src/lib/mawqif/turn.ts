import type { Evaluation } from "./evaluate";
import type { ChoiceView, ExchangeView, PartView } from "./types";

/*
 * What the learner did on a role-play turn, in either answer mode, as the feedback shows it. A
 * chosen reply carries its own key points; a written one, those the service found it covers.
 */

export type Quality = ChoiceView["quality"];

export type TurnOutcome = {
  reply: PartView[];
  met: string[];
  quality: Quality;
  gentler: boolean;
  /** A sentence from the service that passed the warm-line checks; otherwise a fixed line is shown. */
  encouragement: string | null;
};

export function qualityOf(met: number, total: number): Quality {
  if (met === total) return "best";
  return met > 0 ? "acceptable" : "avoid";
}

export const outcomeOfChoice = (choice: ChoiceView): TurnOutcome => ({
  reply: choice.reply,
  met: choice.meets,
  quality: choice.quality,
  gentler: false,
  encouragement: null,
});

export function outcomeOfWriting(exchange: ExchangeView, reply: string, evaluation: Evaluation): TurnOutcome {
  const known = new Set(exchange.keyPoints.map((point) => point.id));
  const met = evaluation.met.filter((id) => known.has(id));
  return {
    reply: [{ kind: "text", text: reply }],
    met,
    quality: qualityOf(met.length, exchange.keyPoints.length),
    gentler: evaluation.tone === "gentler",
    encouragement: evaluation.encouragement ?? null,
  };
}

/** The written choices in a fixed, mixed order, so the best reply is not always first. */
export function orderedChoices(choices: readonly ChoiceView[], turnIndex: number): ChoiceView[] {
  const shift = turnIndex % choices.length;
  return [...choices.slice(shift), ...choices.slice(0, shift)];
}
