"use client";

import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { AnswerView } from "@/components/rafiq/answer-view";
import { RafiqStage } from "@/components/rafiq/rafiq-stage";
import { Button } from "@/components/ui/button";
import { features } from "@/config/features";
import { Link } from "@/i18n/navigation";
import type { RafiqPose } from "@/lib/content/schema";
import type { RafiqResult } from "@/lib/rafiq/answer";
import { LESSON_HELP_MODES, requestLessonHelp, type LessonHelpMode } from "@/lib/rafiq/lesson-help";
import { cn } from "@/lib/utils";

export type HelpTarget = { lessonId: string; cardId: string; line: string };

type Status = { kind: "choosing" } | { kind: "asking" } | RafiqResult;

/** Rafiq listens while the learner chooses and types, thinks while waiting, and points to the answer. */
const POSE: Record<Status["kind"], RafiqPose> = {
  choosing: "listening",
  asking: "thinking",
  answer: "pointing",
  rateLimited: "encouraging",
  unavailable: "encouraging",
  error: "encouraging",
};

/**
 * "I didn't understand" for one line of the board: explain it more simply, give an example, or
 * ask a question. Rafiq answers through POST /api/ai/lesson-help, from this lesson's sources first,
 * while the `rafiq` flag is on; with it off the panel says his help is coming and offers a person.
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
  const tr = useTranslations("Rafiq");
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
        <div className="flex items-end gap-3">
          <RafiqStage pose={POSE[status.kind]} thinking={status.kind === "asking"} height={96} />
          <h2 id="line-help-title" className="pb-2 font-display text-xl font-semibold">
            {t("title")}
          </h2>
        </div>
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
              onChange={() => {
                setMode(option);
                setStatus({ kind: "choosing" });
              }}
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
            <p role="status" className="font-medium">
              {t("thinking")}
            </p>
          )}
          {status.kind === "answer" && (
            <div role="status">
              <AnswerView answer={status.answer} id="line-help" />
            </div>
          )}
          {(status.kind === "error" || status.kind === "unavailable" || status.kind === "rateLimited") && (
            <div role="status" className="grid gap-3">
              <p>{tr(`errors.${status.kind}`)}</p>
              {status.kind !== "rateLimited" && (
                <Button variant="outline" className="justify-self-start" onClick={ask}>
                  {t("retry")}
                </Button>
              )}
              {status.kind === "unavailable" && <HumanLink />}
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
      <p className="font-semibold">{t("comingTitle")}</p>
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
