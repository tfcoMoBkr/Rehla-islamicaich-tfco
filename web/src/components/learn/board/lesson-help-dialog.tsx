"use client";

import { ExternalLink, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { Lantern } from "@/components/journey/lantern";
import { Button } from "@/components/ui/button";
import { features } from "@/config/features";
import { Link } from "@/i18n/navigation";
import {
  LESSON_HELP_MODES,
  requestLessonHelp,
  type LessonHelpMode,
  type LessonHelpResult,
} from "@/lib/rafiq/lesson-help";
import { cn } from "@/lib/utils";

export type HelpTarget = { lessonId: string; cardId: string; line: string };

type Status = { kind: "choosing" } | { kind: "asking" } | LessonHelpResult;

/**
 * "I didn't understand" for one line of the board: explain it more simply, give an example, or
 * ask a question. Rafiq answers through POST /api/ai/lesson-help once the `rafiq` flag is on;
 * until then the panel says his help is coming and offers a person instead. No answer is made up.
 */
export function LessonHelpDialog({ target, onClose }: { target: HelpTarget | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (target && !element.open) element.showModal();
    if (!target && element.open) element.close();
  }, [target]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="line-help-title"
      className="tone-day m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-paper p-0 text-foreground backdrop:bg-night/70 sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      {target && <HelpPanel key={`${target.cardId}:${target.line}`} target={target} onClose={() => dialog.current?.close()} />}
    </dialog>
  );
}

function HelpPanel({ target, onClose }: { target: HelpTarget; onClose: () => void }) {
  const t = useTranslations("LineHelp");
  const locale = useLocale();
  const questionId = useId();
  const [mode, setMode] = useState<LessonHelpMode | null>(null);
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "choosing" });
  const pending = useRef<AbortController | null>(null);
  const available = features.rafiq;

  useEffect(() => () => pending.current?.abort(), []);

  async function ask() {
    if (!mode) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setStatus({ kind: "asking" });
    try {
      const result = await requestLessonHelp(
        {
          lessonId: target.lessonId,
          cardId: target.cardId,
          lineText: target.line,
          mode,
          locale,
          ...(mode === "question" ? { question: question.trim() } : {}),
        },
        { signal: controller.signal },
      );
      setStatus(result);
    } catch {
      if (!controller.signal.aborted) setStatus({ kind: "error" });
    }
  }

  const canAsk = mode !== null && (mode !== "question" || question.trim().length > 0);

  return (
    <div className="grid gap-5 p-5 pb-7 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <h2 id="line-help-title" className="font-display text-xl font-semibold">
          {t("title")}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="-me-2 -mt-1 grid size-11 shrink-0 place-items-center rounded-full hover:bg-accent"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>

      <blockquote className="rounded-xl border-s-4 border-dawn bg-sand px-4 py-3 text-lg leading-relaxed">{target.line}</blockquote>

      <fieldset className="grid gap-2" disabled={!available || status.kind === "asking"}>
        <legend className="mb-2 font-semibold">{t("choose")}</legend>
        {LESSON_HELP_MODES.map((option) => (
          <label
            key={option}
            className={cn(
              "flex min-h-12 items-center gap-3 rounded-xl border-2 border-border bg-card px-4 py-2 font-medium has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:outline-2 has-focus-visible:outline-ring",
              available ? "cursor-pointer" : "cursor-not-allowed opacity-60",
            )}
          >
            <input
              type="radio"
              name="line-help-mode"
              value={option}
              checked={mode === option}
              onChange={() => setMode(option)}
              className="size-5 shrink-0 accent-primary focus-visible:outline-none"
            />
            {t(`modes.${option}`)}
          </label>
        ))}
        {available && mode === "question" && (
          <div className="mt-2 grid gap-1.5">
            <label htmlFor={questionId} className="text-sm font-medium">
              {t("questionLabel")}
            </label>
            <textarea
              id={questionId}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={3}
              maxLength={500}
              className="rounded-xl border-2 border-border bg-card p-3"
            />
          </div>
        )}
      </fieldset>

      {!available ? (
        <ComingSoon />
      ) : (
        <>
          {status.kind === "choosing" && (
            <Button className="justify-self-start" disabled={!canAsk} onClick={ask}>
              {t("ask")}
            </Button>
          )}
          {status.kind === "asking" && (
            <p role="status" className="flex items-center gap-3 font-medium">
              <Lantern state="thinking" className="size-9 shrink-0 text-foreground" />
              {t("thinking")}
            </p>
          )}
          {status.kind === "answer" && (
            <div role="status" className="grid gap-4">
              <p className="text-sm text-muted-foreground">{t("aiNotice")}</p>
              <p className="text-lg leading-relaxed whitespace-pre-line">{status.answer}</p>
              <div>
                <h3 className="font-semibold">{t("sourcesTitle")}</h3>
                <ol className="mt-2 grid list-inside list-decimal gap-1.5">
                  {status.sources.map((source) => (
                    <li key={`${source.url}${source.reference ?? ""}`}>
                      <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 underline underline-offset-4">
                        {source.title}
                        {source.reference && <span dir="ltr">({source.reference})</span>}
                        <ExternalLink aria-hidden className="size-3.5" />
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
          {status.kind === "referral" && (
            <div role="status" className="grid gap-3">
              <p>{t("referral")}</p>
              <HumanLink />
            </div>
          )}
          {status.kind === "error" && (
            <div role="status" className="grid gap-3">
              <p>{t("error")}</p>
              <Button variant="outline" className="justify-self-start" onClick={ask}>
                {t("retry")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ComingSoon() {
  const t = useTranslations("LineHelp");
  return (
    <div role="note" className="grid gap-3 rounded-2xl border border-dawn/50 bg-dawn/10 p-4">
      <p className="flex items-center gap-2 font-semibold">
        <Lantern className="size-7 shrink-0 text-foreground" />
        {t("comingTitle")}
      </p>
      <p>{t("comingBody")}</p>
      <HumanLink />
    </div>
  );
}

function HumanLink() {
  const t = useTranslations("LineHelp");
  return (
    <Link href="/talk-to-a-human" className="justify-self-start font-semibold underline underline-offset-4">
      {t("talkToHuman")}
    </Link>
  );
}
