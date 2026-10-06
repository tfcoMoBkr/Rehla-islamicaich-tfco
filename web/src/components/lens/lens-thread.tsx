"use client";

import { Camera, ImagePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";

import { AnswerView, type LessonLink } from "@/components/rafiq/answer-view";
import { RafiqSays, YouSaid } from "@/components/rafiq/thread";
import { Button } from "@/components/ui/button";
import { LENS_QUESTION_MAX_LENGTH, type TurnResponse } from "@/lib/lens/conversation";
import type { LensResponse } from "@/lib/lens/lens";

import { LensCard } from "./lens-card";
import { LensResult } from "./lens-result";

export type TurnProblem = "rateLimited" | "unavailable" | "error";
export type ThreadItem =
  | { kind: "photo"; key: number; picture: ReactNode; thumbnail: ReactNode; response: LensResponse }
  | { kind: "turn"; key: number; question: string; reply: TurnResponse | null; problem?: TurnProblem };

type Props = {
  items: ThreadItem[];
  lessons?: Readonly<Record<string, LessonLink>>;
  busy: boolean;
  onAsk: (question: string) => void;
  onChoose: (subject: string) => void;
  onNewThread: () => void;
  onAddPhoto: () => void;
};

/**
 * The conversation about a photo, as a thread: the photo pinned at the top, Rafiq's first message
 * about it, then each question and reply. A turn about what can be seen answers from the photo;
 * one about meaning is an ordinary Rafiq answer, with its sources and checks. After each reply,
 * a few questions the learner might ask next.
 */
export function LensThread({ items, lessons, busy, onAsk, onChoose, onNewThread, onAddPhoto }: Props) {
  const t = useTranslations("Lens.conversation");
  const lens = useTranslations("Lens");
  const inputId = useId();
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const last = useRef<HTMLLIElement>(null);
  const photos = items.filter((item) => item.kind === "photo");
  const current = photos.at(-1);
  const declined = current?.kind === "photo" && current.response.card !== null && current.response.card !== undefined && current.response.card !== "nothing";
  const lastReply = [...items].reverse().find((item) => item.kind === "photo" || item.reply);
  const suggestions = lastReply?.kind === "photo" ? lastReply.response.suggestions : (lastReply?.reply?.suggestions ?? []);

  useEffect(() => {
    last.current?.scrollIntoView({ block: "nearest" });
  }, [items.length]);

  function send(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setDraft("");
    onAsk(text);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    send(draft);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(draft);
    }
  }

  return (
    <div className="grid gap-6">
      {current?.kind === "photo" && (
        <div className="sticky top-16 z-10 flex items-center gap-3 rounded-2xl border border-hairline bg-paper/95 p-2 shadow-sm backdrop-blur-none">
          <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-sand" aria-hidden>
            {current.thumbnail}
          </div>
          <p className="min-w-0 flex-1 truncate text-sm">
            <span className="block text-xs font-semibold text-muted-foreground">{t("pinned")}</span>
            <span className="font-semibold">{current.response.seen?.subject || lens("photoAlt")}</span>
          </p>
        </div>
      )}

      <ol className="grid grid-cols-1 gap-6">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          if (item.kind === "photo") {
            return (
              <li key={item.key} ref={isLast ? last : undefined} className="grid gap-6">
                {index > 0 && <p className="text-sm font-semibold text-muted-foreground">{t("newPhoto")}</p>}
                <div className="overflow-hidden rounded-3xl border border-hairline bg-paper">{item.picture}</div>
                {item.response.card ? (
                  <LensCard card={item.response.card} subject={item.response.seen?.subject} onRetake={onNewThread} />
                ) : (
                  <LensResult id={`lens-${item.key}`} response={item.response} lessons={lessons} onChoose={onChoose} />
                )}
              </li>
            );
          }
          return (
            <li key={item.key} ref={isLast ? last : undefined} className="grid gap-4">
              <ol className="grid gap-4">
                <YouSaid>{item.question}</YouSaid>
                <RafiqSays pose={item.reply || item.problem ? "pointing" : "thinking"} thinking={!item.reply && !item.problem}>
                  <TurnReply item={item} lessons={lessons} />
                </RafiqSays>
              </ol>
            </li>
          );
        })}
      </ol>

      {!declined && (
        <form onSubmit={submit} className="grid gap-3 rounded-3xl border border-hairline bg-paper p-4 sm:p-5">
          {suggestions.length > 0 && !busy && (
            <div className="grid gap-2">
              <p className="text-sm font-semibold text-muted-foreground">{t("suggestions")}</p>
              <ul className="flex flex-wrap gap-2">
                {suggestions.map((question) => (
                  <li key={question}>
                    <button
                      type="button"
                      onClick={() => send(question)}
                      dir="auto"
                      className="min-h-11 rounded-full border-2 border-hairline bg-sand px-4 text-start font-medium transition-colors hover:border-dawn focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {question}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <label htmlFor={inputId} className="font-display text-lg font-semibold">
            {t("askLabel")}
          </label>
          <textarea
            id={inputId}
            ref={input}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            maxLength={LENS_QUESTION_MAX_LENGTH}
            placeholder={t("placeholder")}
            dir="auto"
            className="min-h-16 w-full resize-y rounded-xl border-2 border-border bg-card p-3 text-lg leading-relaxed placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{lens("privacyLine")}</p>
            <Button type="submit" disabled={busy || !draft.trim()}>
              {t("ask")}
            </Button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={onAddPhoto} disabled={busy}>
          <ImagePlus aria-hidden />
          {t("addPhoto")}
        </Button>
        <Button type="button" variant="ghost" onClick={onNewThread}>
          <Camera aria-hidden />
          {t("newThread")}
        </Button>
      </div>
    </div>
  );
}

function TurnReply({ item, lessons }: { item: Extract<ThreadItem, { kind: "turn" }>; lessons?: Readonly<Record<string, LessonLink>> }) {
  const t = useTranslations("Lens.conversation");
  if (item.problem) return <p className="leading-relaxed">{t(`errors.${item.problem}`)}</p>;
  if (!item.reply) return <p className="font-medium text-muted-foreground">{t("thinking")}</p>;
  const { visual, answer, card } = item.reply;
  const turnCard = card === "person" || card === "privacy" || card === "timeout" ? card : null;
  return (
    <div className="grid gap-4">
      {visual && (
        <div className="grid gap-1">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">{t("seeing")}</p>
          <p dir="auto" className="text-lg leading-relaxed">
            {visual}
          </p>
        </div>
      )}
      {turnCard && <p className="rounded-xl border border-dawn/50 bg-dawn/8 px-4 py-3">{t(`turnCards.${turnCard}`)}</p>}
      {answer && <AnswerView answer={answer} id={`lens-turn-${item.key}`} lessons={lessons} />}
    </div>
  );
}
