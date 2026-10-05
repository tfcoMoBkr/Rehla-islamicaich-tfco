"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useProgress } from "@/lib/learn/progress-store";
import type { RafiqResult } from "@/lib/rafiq/answer";
import { askRafiq, QUESTION_MAX_LENGTH } from "@/lib/rafiq/ask";
import { conversationStore, keepExchange, OPENED_AT, type StoredExchange } from "@/lib/rafiq/memory";
import { sharedPostStore, type SharedPost } from "@/lib/rafiq/shared-post";

import type { LessonLink } from "./answer-view";
import { MeetRafiq } from "./meet-rafiq";
import { NamePrompt, RafiqMemory, RafiqWelcome, type RoadLesson } from "./rafiq-memory";
import { SharedPostQuote } from "./shared-post-quote";
import { ExchangeView, historyBefore, RafiqSays, type Exchange } from "./thread";

const STARTERS = ["tawhid", "wudu", "wuduBreakers", "prayers"] as const;
/** The counter appears when a question nears the limit. */
const COUNTER_FROM = 800;
const NO_EXCHANGES: StoredExchange[] = [];

const noSubscription = () => () => undefined;
const askedInAddress = () => new URLSearchParams(window.location.search).get("ask")?.slice(0, QUESTION_MAX_LENGTH) ?? null;
const aboutInAddress = () => {
  const about = new URLSearchParams(window.location.search).get("about");
  return about === "post" || about === "reply" ? about : null;
};

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
  const tm = useTranslations("MeetRafiq");
  const input = useRef<HTMLTextAreaElement>(null);
  const locale = useLocale();
  const store = conversationStore(locale);
  const stored = store.use() ?? NO_EXCHANGES;
  const progress = useProgress();
  const reducedMotion = usePrefersReducedMotion();
  const inputId = useId();
  const hintId = useId();
  // Opened from Lens with a question ready (?ask=…): it waits in the box and is sent only when the
  // learner chooses to, so it goes through every check like any question they type.
  const asked = useSyncExternalStore(noSubscription, askedInAddress, () => null);
  // Opened from a community post (?about=post|reply): the post waits above a question the learner
  // can change, and both are sent only when they choose to.
  const about = useSyncExternalStore(noSubscription, aboutInAddress, () => null);
  const handed = sharedPostStore.use();
  const shared = about ? handed : null;
  const [typed, setDraft] = useState<string | null>(null);
  const prefilled = shared ? t(about === "reply" ? "shared.questionReply" : "shared.questionPost") : null;
  const draft = typed ?? asked ?? prefilled ?? "";
  const [asking, setAsking] = useState<Omit<Exchange, "result"> | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const pending = useRef<AbortController | null>(null);
  const replies = useRef(new Map<number, HTMLElement>());

  useEffect(() => () => pending.current?.abort(), []);

  const waiting = Boolean(asked || shared);
  useEffect(() => {
    if (waiting) input.current?.focus();
  }, [waiting]);

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
    const post: SharedPost | undefined = retrying === undefined ? (shared ?? undefined) : current[position]?.shared;
    setAsking({ id, question: text, shared: post });
    setAnnouncement(t("thinking"));
    if (retrying === undefined) {
      setDraft("");
      sharedPostStore.set(null);
    }
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
          shared: post,
        },
        { signal: controller.signal },
      );
    } catch {
      if (controller.signal.aborted) return;
      result = { kind: "error" };
    }
    if (controller.signal.aborted) return;
    keepExchange(locale, { id, question: text, result, ...(post ? { shared: post } : {}) });
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
    sharedPostStore.set(null);
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

      {exchanges.length === 0 && (
        <section aria-labelledby="meet-rafiq-intro" className="rounded-3xl border border-hairline bg-paper/60 p-5 sm:p-6">
          <MeetRafiq
            id="meet-rafiq-intro"
            layout="intro"
            action={
              <Button className="justify-self-start" onClick={() => input.current?.focus()}>
                {tm("start")}
              </Button>
            }
          />
        </section>
      )}

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
        {shared && <SharedPostQuote post={shared} onRemove={() => sharedPostStore.set(null)} />}
        <textarea
          id={inputId}
          ref={input}
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

