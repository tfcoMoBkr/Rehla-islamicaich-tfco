"use client";

import { MessageCircleQuestion, PenLine, Sparkles, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";

import { RafiqFigure } from "@/components/rafiq/rafiq-figure";
import { ReferralCard } from "@/components/rafiq/referral-card";
import { SpecialistCard } from "@/components/specialists/specialist-card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { progressActions } from "@/lib/learn/progress-store";
import { evaluateReply, REPLY_MAX_LENGTH } from "@/lib/mawqif/evaluate";
import { TURN_PROVISIONS, turnKey } from "@/lib/mawqif/progress";
import { orderedChoices, outcomeOfChoice, outcomeOfWriting, type Quality, type TurnOutcome } from "@/lib/mawqif/turn";
import type { ChoiceView, ExchangeView, ItemView } from "@/lib/mawqif/types";
import { fillName, useLearnerName } from "@/lib/rafiq/name";
import { cn } from "@/lib/utils";

import { Parts, QuoteCard, SourceInFull } from "./quote";

type Mode = "choose" | "write";

type Pending =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "fallback" }
  | { kind: "rateLimited" }
  | { kind: "question"; text: string }
  | { kind: "care"; danger: boolean };

export function RoleplayTurn({
  situationId,
  exchange,
  index,
  character,
  items,
  onDone,
}: {
  situationId: string;
  exchange: ExchangeView;
  index: number;
  character: string;
  items: readonly ItemView[];
  onDone: (outcome: TurnOutcome) => void;
}) {
  const t = useTranslations("Mawqif");
  const locale = useLocale() as "ar" | "en";
  const name = useLearnerName();
  const [mode, setMode] = useState<Mode>("choose");
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<Pending>({ kind: "idle" });
  const [outcome, setOutcome] = useState<TurnOutcome | null>(null);
  const inputId = useId();
  const hintId = useId();

  function finish(next: TurnOutcome) {
    if (next.quality === "best") progressActions.earn(turnKey(situationId, exchange.id), TURN_PROVISIONS);
    setOutcome(next);
  }

  function choose(choice: ChoiceView) {
    finish(outcomeOfChoice(choice));
  }

  async function write(event: FormEvent) {
    event.preventDefault();
    const reply = draft.trim();
    if (!reply) return;
    setPending({ kind: "checking" });
    const result = await evaluateReply({ situationId, turnId: exchange.id, reply, locale });
    if (result.status === "rateLimited") return setPending({ kind: "rateLimited" });
    if (result.status === "unavailable" || result.status === "unknownTurn") {
      setMode("choose");
      return setPending({ kind: "fallback" });
    }
    if (result.status === "question") return setPending({ kind: "question", text: reply });
    if (result.status === "danger" || result.status === "distress") return setPending({ kind: "care", danger: result.status === "danger" });
    setPending({ kind: "idle" });
    finish(outcomeOfWriting(exchange, reply, result));
  }

  const itemOf = (ref: string) => items.find((item) => item.id === ref);

  return (
    <div className="grid gap-6">
      <ol className="grid gap-4" aria-label={t("conversation")}>
        <li className="flex items-start gap-3">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-oasis/15 text-oasis-text">
            <UserRound className="size-5" />
          </span>
          <div className="grid max-w-[85%] gap-1">
            <span className="text-sm font-semibold text-muted-foreground">{character}</span>
            <p className="rounded-2xl rounded-ss-sm border border-hairline bg-paper px-4 py-3 text-lg leading-relaxed">
              <Parts parts={exchange.says} />
            </p>
          </div>
        </li>
        {outcome && (
          <li className="flex items-start justify-end gap-3">
            <div className="grid max-w-[85%] gap-1">
              <span className="text-end text-sm font-semibold text-muted-foreground">{t("you")}</span>
              <p dir="auto" className="rounded-2xl rounded-se-sm bg-ink px-4 py-3 text-lg leading-relaxed text-paper">
                <Parts parts={outcome.reply} />
              </p>
            </div>
          </li>
        )}
      </ol>

      {outcome ? (
        <Feedback exchange={exchange} outcome={outcome} itemOf={itemOf} name={name} onNext={() => onDone(outcome)} onRetry={() => setOutcome(null)} />
      ) : (
        <section aria-labelledby={`turn-${exchange.id}-reply`} className="grid gap-4 rounded-3xl border border-hairline bg-sand/60 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <RafiqFigure pose="encouraging" height={72} decorative className="h-16 w-auto shrink-0" />
            <h3 id={`turn-${exchange.id}-reply`} className="font-semibold">
              {t("coachPrompt")}
            </h3>
          </div>

          <div role="radiogroup" aria-label={t("modeLabel")} className="flex flex-wrap gap-2">
            {(["choose", "write"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={mode === option}
                onClick={() => setMode(option)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 font-medium transition-colors",
                  mode === option ? "border-ink bg-ink text-paper" : "border-hairline bg-paper hover:border-dawn",
                )}
              >
                {option === "choose" ? <Sparkles aria-hidden className="size-4" /> : <PenLine aria-hidden className="size-4" />}
                {t(option === "choose" ? "modeChoose" : "modeWrite")}
              </button>
            ))}
          </div>

          {pending.kind === "fallback" && <p role="status" className="rounded-xl bg-paper px-4 py-3 text-muted-foreground">{t("fallbackNote")}</p>}

          {mode === "choose" ? (
            <ul className="grid gap-2">
              {orderedChoices(exchange.choices, index).map((choice) => (
                <li key={choice.id}>
                  <button
                    type="button"
                    onClick={() => choose(choice)}
                    className="w-full rounded-2xl border-2 border-hairline bg-paper px-4 py-3 text-start text-lg leading-relaxed transition-colors hover:border-dawn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Parts parts={choice.reply} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <form onSubmit={(event) => void write(event)} className="grid gap-3">
              <label htmlFor={inputId} className="font-semibold">
                {t("writeLabel")}
              </label>
              <textarea
                id={inputId}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={REPLY_MAX_LENGTH}
                rows={3}
                dir="auto"
                aria-describedby={hintId}
                className="min-h-24 w-full resize-y rounded-xl border-2 border-border bg-card p-3 text-lg leading-relaxed"
              />
              <p id={hintId} className="text-sm text-muted-foreground">
                {t("writeHint")}
              </p>
              <Button type="submit" disabled={!draft.trim() || pending.kind === "checking"} className="justify-self-start">
                {pending.kind === "checking" ? t("checking") : t("checkReply")}
              </Button>
              {pending.kind === "rateLimited" && <p role="status" className="text-muted-foreground">{t("rateLimited")}</p>}
              {pending.kind === "question" && (
                <div role="status" className="grid gap-3 rounded-2xl border border-dawn/50 bg-paper p-4">
                  <p>{t("questionNote")}</p>
                  <Button asChild variant="outline" className="justify-self-start">
                    <Link href={{ pathname: "/rafiq", query: { ask: pending.text } }}>
                      <MessageCircleQuestion aria-hidden />
                      {t("askRafiqThis")}
                    </Link>
                  </Button>
                </div>
              )}
              {pending.kind === "care" && (
                <div role="status" className="grid gap-4">
                  <ReferralCard reason={pending.danger ? "danger" : "distress"} links={["/talk-to-a-specialist"]} />
                  <SpecialistCard />
                </div>
              )}
            </form>
          )}
        </section>
      )}
    </div>
  );
}

const HEADINGS: Record<Quality, "feedbackBest" | "feedbackAcceptable" | "feedbackAvoid"> = {
  best: "feedbackBest",
  acceptable: "feedbackAcceptable",
  avoid: "feedbackAvoid",
};

/** After a turn: what was good, what was missing with its source, and one warm line. Never scolding. */
export function Feedback({
  exchange,
  outcome,
  itemOf,
  name,
  onNext,
  onRetry,
}: {
  exchange: ExchangeView;
  outcome: TurnOutcome;
  itemOf: (ref: string) => ItemView | undefined;
  name: string | null;
  onNext: () => void;
  onRetry: () => void;
}) {
  const t = useTranslations("Mawqif");
  const good = exchange.keyPoints.filter((point) => outcome.met.includes(point.id));
  const missing = exchange.keyPoints.filter((point) => !outcome.met.includes(point.id));
  // Rafiq's own sentence when it passed the checks; otherwise a fixed, warm line.
  // The fixed lines carry the name placeholder as an argument, filled or removed like Rafiq's.
  const warm = fillName(outcome.encouragement ?? t(`${HEADINGS[outcome.quality]}Line`, { name: "{{name}}" }), name);

  return (
    <section aria-live="polite" aria-labelledby={`feedback-${exchange.id}`} className="grid gap-4 rounded-3xl border border-hairline bg-paper p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <RafiqFigure pose={outcome.quality === "best" ? "happy" : "encouraging"} height={80} decorative className="h-20 w-auto shrink-0" />
        <div className="grid gap-1">
          <h3 id={`feedback-${exchange.id}`} className="font-display text-xl font-semibold">
            {t(HEADINGS[outcome.quality])}
          </h3>
          <p>{warm}</p>
          {outcome.gentler && <p className="text-muted-foreground">{t("gentler")}</p>}
        </div>
      </div>

      {good.length > 0 && (
        <div className="grid gap-2">
          <h4 className="font-semibold text-oasis-text">{t("whatWasGood")}</h4>
          {good.map((point) => (
            <QuoteCard key={point.id} quote={point.quote} />
          ))}
        </div>
      )}
      {missing.length > 0 && (
        <div className="grid gap-2">
          <h4 className="font-semibold">{t("whatWasMissing")}</h4>
          {missing.map((point) => {
            const item = itemOf(point.quote.ref);
            return (
              <div key={point.id} className="grid gap-2">
                <QuoteCard quote={point.quote} />
                {item && <SourceInFull item={item} />}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button onClick={onNext}>{t("continue")}</Button>
        {outcome.quality !== "best" && (
          <Button variant="outline" onClick={onRetry}>
            {t("tryAgain")}
          </Button>
        )}
      </div>
    </section>
  );
}
