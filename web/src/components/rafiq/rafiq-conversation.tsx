"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { Link } from "@/i18n/navigation";
import type { RafiqPose } from "@/lib/content/schema";
import { useProgress } from "@/lib/learn/progress-store";
import { answerText, type RafiqResult } from "@/lib/rafiq/answer";
import { askRafiq, HISTORY_TURNS, QUESTION_MAX_LENGTH, type Turn } from "@/lib/rafiq/ask";

import { AnswerView, type LessonLink } from "./answer-view";
import { RafiqStage } from "./rafiq-stage";

const STARTERS = ["tawhid", "wudu", "wuduBreakers", "prayers"] as const;
/** The counter appears when a question nears the limit. */
const COUNTER_FROM = 800;

type Exchange = { id: number; question: string; result: RafiqResult | null };

function poseFor(exchanges: readonly Exchange[], draft: string): RafiqPose {
  const last = exchanges.at(-1);
  if (last && !last.result) return "thinking";
  if (draft.trim()) return "listening";
  if (!last) return "hello";
  return last.result?.kind === "answer" ? "pointing" : "encouraging";
}

function historyOf(exchanges: readonly Exchange[]): Turn[] {
  const turns: Turn[] = [];
  for (const { question, result } of exchanges) {
    if (result?.kind !== "answer") continue;
    const text = answerText(result.answer);
    if (!text) continue;
    turns.push({ role: "user", text: question }, { role: "assistant", text });
  }
  return turns.slice(-HISTORY_TURNS);
}

/**
 * Ask Rafiq: each question and its answer is a stop on a short road. The conversation lives in
 * this component's memory only; nothing is stored, and leaving the page forgets it.
 */
export function RafiqConversation({ lessons }: { lessons: Readonly<Record<string, LessonLink>> }) {
  const t = useTranslations("Rafiq");
  const locale = useLocale();
  const progress = useProgress();
  const reducedMotion = usePrefersReducedMotion();
  const inputId = useId();
  const hintId = useId();
  const [draft, setDraft] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const pending = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const stops = useRef(new Map<number, HTMLLIElement>());

  useEffect(() => () => pending.current?.abort(), []);

  const waiting = exchanges.at(-1)?.result === null;

  async function ask(question: string, replacing?: number) {
    const text = question.trim();
    if (!text || waiting) return;
    const id = replacing ?? nextId.current++;
    const earlier = exchanges.filter((exchange) => exchange.id !== id);
    setExchanges([...earlier, { id, question: text, result: null }]);
    setAnnouncement(t("thinking"));
    if (replacing === undefined) setDraft("");
    requestAnimationFrame(() =>
      stops.current.get(id)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" }),
    );

    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    try {
      const result = await askRafiq(
        {
          question: text,
          locale,
          reachedLessonIds: Object.keys(progress.completedLessons),
          history: historyOf(earlier),
        },
        { signal: controller.signal },
      );
      setExchanges((current) => current.map((exchange) => (exchange.id === id ? { ...exchange, result } : exchange)));
      setAnnouncement(result.kind === "answer" ? t("answered") : t(`errors.${result.kind}`));
    } catch {
      if (controller.signal.aborted) return;
      setExchanges((current) => current.map((exchange) => (exchange.id === id ? { ...exchange, result: { kind: "error" } } : exchange)));
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(draft);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void ask(draft);
    }
  }

  function startAgain() {
    pending.current?.abort();
    setExchanges([]);
    setDraft("");
    setAnnouncement("");
  }

  return (
    <div className="grid gap-8">
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {exchanges.length === 0 ? (
        <section aria-labelledby="rafiq-starters" className="grid gap-4">
          <div className="grid gap-1">
            <h2 className="font-display text-xl font-semibold">{t("emptyTitle")}</h2>
            <p className="leading-relaxed text-muted-foreground">{t("emptyBody")}</p>
          </div>
          <h3 id="rafiq-starters" className="text-sm font-semibold text-muted-foreground">
            {t("startersTitle")}
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {STARTERS.map((starter) => (
              <li key={starter}>
                <button
                  type="button"
                  onClick={() => void ask(t(`starters.${starter}`))}
                  className="flex min-h-12 w-full items-center rounded-xl border-2 border-hairline bg-paper px-4 py-2 text-start font-medium transition-colors hover:border-dawn hover:bg-dawn/8 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {t(`starters.${starter}`)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <ol className="relative grid gap-10 before:absolute before:inset-y-2 before:start-[0.6875rem] before:border-s-2 before:border-dashed before:border-hairline">
          {exchanges.map((exchange) => (
            <li
              key={exchange.id}
              ref={(element) => {
                if (element) stops.current.set(exchange.id, element);
                else stops.current.delete(exchange.id);
              }}
              className="relative grid scroll-mt-24 gap-4 ps-9"
            >
              <span aria-hidden className="absolute start-0 top-1 size-6 rounded-full border-2 border-dawn bg-sand" />
              <div className="grid gap-1">
                <h2 className="text-sm font-semibold text-muted-foreground">{t("yourQuestion")}</h2>
                <p dir="auto" className="font-display text-xl leading-relaxed font-semibold whitespace-pre-line">
                  {exchange.question}
                </p>
              </div>
              <article
                aria-label={t("rafiqAnswer")}
                aria-busy={!exchange.result}
                className="rounded-2xl border border-hairline border-s-4 border-s-dawn bg-paper p-5 shadow-sm sm:p-6"
              >
                <ExchangeResult
                  exchange={exchange}
                  lessons={lessons}
                  onRetry={() => void ask(exchange.question, exchange.id)}
                />
              </article>
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={submit} className="grid gap-3 rounded-3xl border border-hairline bg-paper p-4 sm:p-5">
        <div className="flex items-end gap-3">
          <RafiqStage pose={poseFor(exchanges, draft)} thinking={waiting} />
          <label htmlFor={inputId} className="pb-2 font-display text-lg font-semibold">
            {exchanges.length ? t("askAnother") : t("questionLabel")}
          </label>
        </div>
        <textarea
          id={inputId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          rows={3}
          maxLength={QUESTION_MAX_LENGTH}
          placeholder={t("placeholder")}
          aria-describedby={hintId}
          dir="auto"
          className="min-h-24 w-full resize-y rounded-xl border-2 border-border bg-card p-3 text-lg leading-relaxed placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p id={hintId} className="text-sm text-muted-foreground">
            {draft.length >= COUNTER_FROM
              ? t("count", { count: draft.length, max: QUESTION_MAX_LENGTH })
              : t("enterHint")}
          </p>
          <div className="flex flex-wrap gap-2">
            {exchanges.length > 0 && (
              <Button type="button" variant="outline" onClick={startAgain}>
                {t("startAgain")}
              </Button>
            )}
            <Button type="submit" disabled={waiting || !draft.trim()}>
              {t("ask")}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ExchangeResult({
  exchange,
  lessons,
  onRetry,
}: {
  exchange: Exchange;
  lessons: Readonly<Record<string, LessonLink>>;
  onRetry: () => void;
}) {
  const t = useTranslations("Rafiq");
  const { result } = exchange;

  if (!result) {
    return <p className="font-medium text-muted-foreground">{t("thinking")}</p>;
  }
  if (result.kind === "answer") {
    return <AnswerView answer={result.answer} id={`rafiq-${exchange.id}`} lessons={lessons} />;
  }
  return (
    <div className="grid gap-3">
      <p className="leading-relaxed">{t(`errors.${result.kind}`)}</p>
      <div className="flex flex-wrap items-center gap-4">
        {result.kind !== "rateLimited" && (
          <Button variant="outline" onClick={onRetry}>
            {t("retry")}
          </Button>
        )}
        {result.kind === "unavailable" && (
          <Link href="/talk-to-a-human" className="font-semibold underline underline-offset-4">
            {t("talkToHuman")}
          </Link>
        )}
      </div>
    </div>
  );
}
