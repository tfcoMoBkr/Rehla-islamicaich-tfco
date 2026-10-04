"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { Link } from "@/i18n/navigation";
import type { RafiqPose } from "@/lib/content/schema";
import { useProgress } from "@/lib/learn/progress-store";
import { replyText, type RafiqResult } from "@/lib/rafiq/answer";
import { askRafiq, HISTORY_TURNS, QUESTION_MAX_LENGTH, type Turn } from "@/lib/rafiq/ask";
import { conversationStore, keepExchange, OPENED_AT, type StoredExchange } from "@/lib/rafiq/memory";

import { AnswerView, type LessonLink } from "./answer-view";
import { NamePrompt, RafiqMemory, RafiqWelcome, type RoadLesson } from "./rafiq-memory";
import { RafiqStage } from "./rafiq-stage";

const STARTERS = ["tawhid", "wudu", "wuduBreakers", "prayers"] as const;
/** The counter appears when a question nears the limit. */
const COUNTER_FROM = 800;
const NO_EXCHANGES: StoredExchange[] = [];

type Exchange = { id: number; question: string; result: RafiqResult | null };

function poseFor(result: RafiqResult | null): RafiqPose {
  if (!result) return "thinking";
  if (result.kind !== "answer") return "encouraging";
  switch (result.answer.kind) {
    case "chat":
      return "happy";
    case "clarify":
      return "listening";
    case "answer":
      return result.answer.blocks.length > 0 ? "pointing" : "encouraging";
    default:
      return "encouraging";
  }
}

/** The turns before a question, as the service reads them: what was asked and what Rafiq said. */
function historyBefore(exchanges: readonly Exchange[]): Turn[] {
  const turns: Turn[] = [];
  for (const { question, result } of exchanges) {
    if (result?.kind !== "answer") continue;
    const text = replyText(result.answer);
    if (!text) continue;
    turns.push({ role: "user", text: question }, { role: "assistant", text });
  }
  return turns.slice(-HISTORY_TURNS);
}

/**
 * Ask Rafiq: a conversation between the learner and their companion. It is kept on this device in
 * the page's language, restored on return and cleared by "Start again"; each question carries the
 * last turns so Rafiq can follow it, and the service keeps none of it.
 */
export function RafiqConversation({
  lessons,
  road,
}: {
  lessons: Readonly<Record<string, LessonLink>>;
  road: readonly RoadLesson[];
}) {
  const t = useTranslations("Rafiq");
  const locale = useLocale();
  const store = conversationStore(locale);
  const stored = store.use() ?? NO_EXCHANGES;
  const progress = useProgress();
  const reducedMotion = usePrefersReducedMotion();
  const inputId = useId();
  const hintId = useId();
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState<Omit<Exchange, "result"> | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const pending = useRef<AbortController | null>(null);
  const replies = useRef(new Map<number, HTMLElement>());

  useEffect(() => () => pending.current?.abort(), []);

  const exchanges: Exchange[] = stored.map((exchange) => (exchange.id === asking?.id ? { ...exchange, result: null } : exchange));
  if (asking && !stored.some((exchange) => exchange.id === asking.id)) exchanges.push({ ...asking, result: null });
  const returning = stored.some((exchange) => exchange.at < OPENED_AT);

  async function ask(question: string, retrying?: number) {
    const text = question.trim();
    if (!text || asking) return;
    const current = store.read() ?? [];
    const id = retrying ?? Math.max(0, ...current.map((exchange) => exchange.id)) + 1;
    const position = current.findIndex((exchange) => exchange.id === id);
    const before = position === -1 ? current : current.slice(0, position);
    setAsking({ id, question: text });
    setAnnouncement(t("thinking"));
    if (retrying === undefined) setDraft("");
    requestAnimationFrame(() =>
      replies.current.get(id)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" }),
    );

    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    let result: RafiqResult;
    try {
      result = await askRafiq(
        {
          question: text,
          locale,
          reachedLessonIds: Object.keys(progress.completedLessons),
          history: historyBefore(before),
        },
        { signal: controller.signal },
      );
    } catch {
      if (controller.signal.aborted) return;
      result = { kind: "error" };
    }
    if (controller.signal.aborted) return;
    keepExchange(locale, { id, question: text, result });
    setAsking(null);
    setAnnouncement(result.kind === "answer" ? t("answered") : t(`errors.${result.kind}`));
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

  function stopAsking() {
    pending.current?.abort();
    setAsking(null);
  }

  function startAgain() {
    stopAsking();
    store.set(null);
    setDraft("");
    setAnnouncement("");
  }

  const replyRef = (id: number) => (element: HTMLElement | null) => {
    if (element) replies.current.set(id, element);
    else replies.current.delete(id);
  };

  return (
    <div className="grid grid-cols-1 gap-8">
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <ol className="grid grid-cols-1 gap-6">
        <RafiqSays pose={exchanges.length ? "waving" : "hello"}>
          <div className="grid gap-4">
            <RafiqWelcome road={road} returning={returning} />
            {exchanges.length === 0 && (
              <section aria-labelledby="rafiq-starters" className="grid gap-3">
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
                        className="flex min-h-12 w-full items-center rounded-xl border-2 border-hairline bg-sand px-4 py-2 text-start font-medium transition-colors hover:border-dawn hover:bg-dawn/8 focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        {t(`starters.${starter}`)}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </RafiqSays>

        {exchanges.map((exchange) => (
          <ExchangeView
            key={exchange.id}
            exchange={exchange}
            lessons={lessons}
            replyRef={replyRef(exchange.id)}
            onRetry={() => void ask(exchange.question, exchange.id)}
          />
        ))}
      </ol>

      <NamePrompt />

      <form onSubmit={submit} className="grid gap-3 rounded-3xl border border-hairline bg-paper p-4 sm:p-5">
        <label htmlFor={inputId} className="font-display text-lg font-semibold">
          {exchanges.length ? t("askAnother") : t("questionLabel")}
        </label>
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
            <Button type="submit" disabled={asking !== null || !draft.trim()}>
              {t("ask")}
            </Button>
          </div>
        </div>
      </form>

      <RafiqMemory road={road} messages={stored.length * 2} onCleared={stopAsking} />
    </div>
  );
}

/** Rafiq's turn: his figure and name at the start side, what he says beside them. */
function RafiqSays({
  pose,
  thinking = false,
  articleRef,
  children,
}: {
  pose: RafiqPose;
  thinking?: boolean;
  articleRef?: (element: HTMLElement | null) => void;
  children: ReactNode;
}) {
  const t = useTranslations("Rafiq");
  return (
    <li className="flex items-start gap-3">
      <div className="flex w-14 shrink-0 flex-col items-center gap-1 pt-1">
        <RafiqStage pose={pose} thinking={thinking} height={56} decorative />
        <span className="text-xs font-semibold text-muted-foreground">{t("rafiqName")}</span>
      </div>
      <article
        ref={articleRef}
        aria-label={t("rafiqAnswer")}
        aria-busy={thinking}
        className="min-w-0 flex-1 scroll-mt-24 rounded-2xl rounded-ss-sm border border-hairline bg-paper p-5 shadow-sm sm:p-6"
      >
        {children}
      </article>
    </li>
  );
}

/** The learner's turn, on the end side. */
function YouSaid({ children }: { children: string }) {
  const t = useTranslations("Rafiq");
  return (
    <li className="flex justify-end ps-12">
      <div className="grid max-w-full gap-1 rounded-2xl rounded-se-sm bg-ink px-4 py-3 text-paper">
        <span className="text-xs font-semibold opacity-80">{t("you")}</span>
        <p dir="auto" className="text-lg leading-relaxed whitespace-pre-line">
          {children}
        </p>
      </div>
    </li>
  );
}

function ExchangeView({
  exchange,
  lessons,
  replyRef,
  onRetry,
}: {
  exchange: Exchange;
  lessons: Readonly<Record<string, LessonLink>>;
  replyRef: (element: HTMLElement | null) => void;
  onRetry: () => void;
}) {
  const t = useTranslations("Rafiq");
  const { result } = exchange;
  return (
    <>
      <YouSaid>{exchange.question}</YouSaid>
      <RafiqSays pose={poseFor(result)} thinking={!result} articleRef={replyRef}>
        {!result ? (
          <p className="font-medium text-muted-foreground">{t("thinking")}</p>
        ) : result.kind === "answer" ? (
          <AnswerView answer={result.answer} id={`rafiq-${exchange.id}`} lessons={lessons} />
        ) : (
          <div className="grid gap-3">
            <p className="leading-relaxed">{t(`errors.${result.kind}`)}</p>
            <div className="flex flex-wrap items-center gap-4">
              {result.kind !== "rateLimited" && (
                <Button variant="outline" onClick={onRetry}>
                  {t("retry")}
                </Button>
              )}
              {result.kind === "unavailable" && (
                <Link href="/talk-to-a-specialist" className="font-semibold underline underline-offset-4">
                  {t("talkToSpecialist")}
                </Link>
              )}
            </div>
          </div>
        )}
      </RafiqSays>
    </>
  );
}
