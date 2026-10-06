"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { RafiqFigure } from "@/components/rafiq/rafiq-figure";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { keyPointsOf } from "@/lib/mawqif/conversation";
import { getFeedback, type ReplyFeedback } from "@/lib/mawqif/practice";
import type { SituationView } from "@/lib/mawqif/types";
import { fillName, useLearnerName } from "@/lib/rafiq/name";

import type { ConversationResult } from "./practice-conversation";
import { QuoteCard } from "./quote";

type State = { kind: "loading" } | { kind: "ready"; replies: ReplyFeedback[] } | { kind: "unavailable" };

/**
 * After the conversation: for each of the learner's replies, what was good and what was missing,
 * and where a reply could be better, a reply they could say ("you could say", never a correction).
 * Its religious words are the situation's own quotes, inserted by the service.
 */
export function PracticeFeedback({ situation, result }: { situation: SituationView; result: ConversationResult }) {
  const t = useTranslations("Mawqif");
  const locale = useLocale() as "ar" | "en";
  const name = useLearnerName();
  const points = keyPointsOf(situation);
  const learnerReplies = result.history.filter((line) => line.role === "learner");
  const [state, setState] = useState<State>(learnerReplies.length ? { kind: "loading" } : { kind: "ready", replies: [] });
  const [asked, setAsked] = useState(0);

  useEffect(() => {
    if (learnerReplies.length === 0) return;
    let current = true;
    void getFeedback({ situationId: situation.id, locale, scene: result.scene, history: result.history, met: result.met }).then((response) => {
      if (!current) return;
      setState(response.status === "ready" && "replies" in response ? { kind: "ready", replies: response.replies } : { kind: "unavailable" });
    });
    return () => {
      current = false;
    };
    // The feedback is asked for once per finished conversation, and again on "try again".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, asked]);

  const covered = points.filter((point) => result.met.includes(point.id));
  const all = covered.length === points.length;

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-3">
        <RafiqFigure pose={all ? "happy" : "encouraging"} height={80} decorative className="h-20 w-auto shrink-0" />
        <div className="grid gap-1">
          <p className="text-lg font-semibold">{t("feedbackScore", { met: covered.length, total: points.length })}</p>
          {all && <p className="text-oasis-text">{t("feedbackMastered")}</p>}
        </div>
      </div>

      {state.kind === "loading" && (
        <p role="status" className="text-muted-foreground">
          {t("checking")}
        </p>
      )}
      {state.kind === "unavailable" && (
        <div role="alert" className="grid gap-3 rounded-xl border border-dawn/50 bg-dawn/8 px-4 py-3">
          <p>{t("feedbackUnavailable")}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => {
                setState({ kind: "loading" });
                setAsked((count) => count + 1);
              }}>
              {t("feedbackRetry")}
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/mawqif">{t("backToMap")}</Link>
            </Button>
          </div>
        </div>
      )}

      {state.kind === "ready" && (
        <ol className="grid gap-4">
          {learnerReplies.map((reply, index) => {
            const feedback = state.replies.find((item) => item.n === index + 1);
            return (
              <li key={index} className="grid gap-2 rounded-2xl border border-hairline bg-paper p-4">
                <p className="text-sm font-semibold text-muted-foreground">{t("youSaid")}</p>
                <p dir="auto" className="text-lg">
                  {reply.text}
                </p>
                {feedback?.good && (
                  <p>
                    <span className="font-semibold">{t("whatWasGood")}: </span>
                    {fillName(feedback.good, name)}
                  </p>
                )}
                {feedback?.better && (
                  <p className="rounded-xl bg-oasis/8 px-3 py-2">
                    <span className="font-semibold">{t("couldSay")}: </span>
                    <span dir="auto">{feedback.better}</span>
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <section className="grid gap-3">
        {covered.length > 0 && (
          <>
            <h3 className="font-semibold">{t("keyPointsMet")}</h3>
            {covered.map((point) => (
              <QuoteCard key={point.id} quote={point.quote} />
            ))}
          </>
        )}
        {!all && (
          <>
            <h3 className="font-semibold">{t("keyPointsMissing")}</h3>
            {points
              .filter((point) => !result.met.includes(point.id))
              .map((point) => (
                <QuoteCard key={point.id} quote={point.quote} />
              ))}
          </>
        )}
      </section>
    </div>
  );
}
