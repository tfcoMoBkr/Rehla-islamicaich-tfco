"use client";

import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { RafiqReply, YouSaid } from "@/components/rafiq/thread";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { useProgress } from "@/lib/learn/progress-store";
import { replyText, type RafiqResult } from "@/lib/rafiq/answer";
import { QUESTION_MAX_LENGTH } from "@/lib/rafiq/ask";
import {
  newExchange,
  openingExchange,
  sameSubject,
  sendLessonExchange,
  type PendingExchange,
} from "@/lib/rafiq/lesson-conversation";
import type { LessonHelpMode } from "@/lib/rafiq/lesson-help";
import { readLessonThread, useLessonThread, type LessonExchange, type LessonSubject } from "@/lib/rafiq/lesson-threads";
import { keepExchange } from "@/lib/rafiq/memory";

export type HelpTarget = { lessonId: string } & LessonSubject;

const QUICK = ["simpler", "example"] as const;

const textOf = (result: RafiqResult) => (result.kind === "answer" ? replyText(result.answer) : "");

/**
 * Rafiq beside the lesson board: a conversation about the line on the board, not a one-off answer.
 * His first message explains the line; the learner can then ask for it simpler, for an example, or
 * anything else, and the thread goes on with what was said (kept on the device for this lesson).
 * It opens as a sheet on a phone and beside the board on a wider screen; closing it puts the
 * learner back where they were.
 */
export function LessonRafiqPanel({ target, onClose }: { target: HelpTarget; onClose: () => void }) {
  const t = useTranslations("LineHelp");
  const locale = useLocale();
  const router = useRouter();
  const progress = useProgress();
  const thread = useLessonThread(target.lessonId);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const inputId = useId();
  const subject = { cardId: target.cardId, line: target.line };
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState<PendingExchange | null>(() => openingExchange(target.lessonId, subject));
  const pending = useRef<AbortController | null>(null);
  // Where the learner was when they opened the panel: focus goes back there when it closes.
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.showModal();
    return () => pending.current?.abort();
  }, []);

  function closed() {
    opener.current?.focus();
    onClose();
  }

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [thread.length, asking]);

  /** Asks Rafiq; the reply lands in the lesson's thread, and the panel stops waiting. */
  function send(exchange: PendingExchange) {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    return sendLessonExchange(target.lessonId, exchange, {
      locale,
      reachedLessonIds: Object.keys(progress.completedLessons),
      replyText: textOf,
      signal: controller.signal,
    }).then((result) => {
      if (result) setAsking(null);
    });
  }

  function ask(mode: LessonHelpMode, said: string, retrying?: LessonExchange) {
    if (asking) return;
    const exchange = retrying ? { id: retrying.id, subject: retrying.subject, mode, said } : newExchange(target.lessonId, subject, mode, said);
    setAsking(exchange);
    void send(exchange);
  }

  const sendFirst = useEffectEvent(() => {
    if (asking?.mode === "explain") void send(asking);
  });
  useEffect(() => {
    sendFirst();
  }, []);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    ask("question", text);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
  }

  function continueOnRafiq() {
    for (const item of readLessonThread(target.lessonId)) {
      keepExchange(locale, { id: Date.now() + item.id, question: item.said || item.subject.line, result: item.result });
    }
    dialog.current?.close();
    router.push("/rafiq");
  }

  const shown: (LessonExchange | (PendingExchange & { result: null }))[] = [
    ...thread.filter((item) => item.id !== asking?.id),
    ...(asking ? [{ ...asking, result: null }] : []),
  ];
  const lastAnswered = thread.at(-1)?.result.kind === "answer" && !asking;

  return (
    <dialog
      ref={dialog}
      onClose={closed}
      aria-labelledby={titleId}
      className="tone-day m-0 mt-auto flex max-h-[92dvh] w-full max-w-none flex-col overflow-hidden rounded-t-3xl bg-sand p-0 text-foreground backdrop:bg-night/60 sm:my-0 sm:ms-auto sm:me-0 sm:h-dvh sm:max-h-dvh sm:w-[30rem] sm:rounded-none sm:rounded-s-3xl"
    >
      <header className="flex items-center justify-between gap-3 border-b border-hairline bg-paper px-5 py-3">
        <h2 id={titleId} className="font-display text-xl font-semibold">
          {t("panelTitle")}
        </h2>
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          aria-label={t("close")}
          className="-me-2 grid size-11 shrink-0 place-items-center rounded-full hover:bg-accent"
        >
          <X aria-hidden className="size-5" />
        </button>
      </header>

      <div className="grid gap-1.5 border-b border-hairline bg-paper px-5 py-3">
        <p className="text-sm font-semibold text-muted-foreground">{t("subject")}</p>
        <blockquote className="line-clamp-4 rounded-xl border-s-4 border-dawn bg-sand px-4 py-2 leading-relaxed">{target.line}</blockquote>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <ol className="grid grid-cols-1 gap-5">
          {shown.map((item, index) => {
            const previous = shown[index - 1];
            const newSubject = previous && !sameSubject(previous.subject, item.subject);
            return (
              <li key={item.id} className="grid gap-4">
                {newSubject && (
                  <div className="grid gap-1 text-sm">
                    <p className="font-semibold text-muted-foreground">{t("newSubject")}</p>
                    <p className="line-clamp-2 border-s-2 border-dawn ps-3">{item.subject.line}</p>
                  </div>
                )}
                <ol className="grid grid-cols-1 gap-4">
                  {item.said && <YouSaid>{item.said}</YouSaid>}
                  <RafiqReply
                    id={`lesson-${target.lessonId}-${item.id}`}
                    result={item.result}
                    onRetry={() => {
                      const kept = thread.find((candidate) => candidate.id === item.id);
                      if (kept) ask(kept.mode, kept.said, kept);
                    }}
                  />
                </ol>
              </li>
            );
          })}
        </ol>
        <div ref={end} />
      </div>

      <div className="grid gap-3 border-t border-hairline bg-paper px-4 pt-3 pb-4">
        {lastAnswered && (
          <ul className="flex flex-wrap gap-2">
            {QUICK.map((mode) => (
              <li key={mode}>
                <Button variant="outline" size="sm" className="min-h-11" onClick={() => ask(mode, t(`quick.${mode}`))}>
                  {t(`quick.${mode}`)}
                </Button>
              </li>
            ))}
            <li>
              <Button variant="outline" size="sm" className="min-h-11" onClick={() => input.current?.focus()}>
                {t("quick.another")}
              </Button>
            </li>
          </ul>
        )}
        <form onSubmit={submit} className="flex items-end gap-2">
          <label htmlFor={inputId} className="sr-only">
            {t("replyLabel")}
          </label>
          <textarea
            id={inputId}
            ref={input}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            maxLength={QUESTION_MAX_LENGTH}
            placeholder={t("replyPlaceholder")}
            dir="auto"
            className="min-h-12 flex-1 resize-none rounded-xl border-2 border-border bg-card p-2.5 leading-relaxed placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none"
          />
          <Button type="submit" disabled={asking !== null || !draft.trim()}>
            {t("send")}
          </Button>
        </form>
        {thread.length > 0 && (
          <button type="button" onClick={continueOnRafiq} className="justify-self-start text-sm font-semibold text-primary underline underline-offset-4">
            {t("continueOnRafiq")}
          </button>
        )}
      </div>
    </dialog>
  );
}
