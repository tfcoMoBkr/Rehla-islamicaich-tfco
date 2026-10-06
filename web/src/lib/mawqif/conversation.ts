import type { QuoteView, SituationView } from "./types";

/*
 * Practice conversations, apart from their screens: the key points a conversation is judged
 * against, which situations a conversation test takes, and what its result says.
 */

const MAX_CONVERSATIONS = 4;

/** Every key point of the situation, once, in the order the turns ask for them. */
export function keyPointsOf(situation: SituationView): { id: string; quote: QuoteView }[] {
  const seen = new Map<string, QuoteView>();
  for (const exchange of situation.exchanges) for (const point of exchange.keyPoints) if (!seen.has(point.id)) seen.set(point.id, point.quote);
  return [...seen].map(([id, quote]) => ({ id, quote }));
}

export type ConversationScore = { situation: string; met: number; total: number };

/** What the test says at the end: the score from key points, and what to do next. */
export function analyseConversations(scores: readonly ConversationScore[]) {
  const met = scores.reduce((sum, score) => sum + score.met, 0);
  const total = scores.reduce((sum, score) => sum + score.total, 0);
  return {
    met,
    total,
    strong: scores.filter((score) => score.total > 0 && score.met === score.total).map((score) => score.situation),
    practise: scores.filter((score) => score.met < score.total).map((score) => score.situation),
  };
}

/** The situations to test: those the learner has practised in this part, else all of them. */
export function testSituations<T extends { id: string }>(views: readonly T[], practised: (id: string) => boolean): T[] {
  const done = views.filter((view) => practised(view.id));
  return (done.length >= 2 ? done : views).slice(0, MAX_CONVERSATIONS);
}
