"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { RafiqPose } from "@/lib/content/schema";
import { replyText, type RafiqResult } from "@/lib/rafiq/answer";
import { HISTORY_TURNS, type Turn } from "@/lib/rafiq/ask";
import type { SharedPost } from "@/lib/rafiq/shared-post";

import { AnswerView, type LessonLink } from "./answer-view";
import { RafiqStage } from "./rafiq-stage";
import { SharedPostQuote } from "./shared-post-quote";

/*
 * A conversation with Rafiq as two people talking: his turns at the start side with his figure and
 * name, the learner's at the end side. Shared by his page and the panel beside the lesson board.
 */

export type Exchange = { id: number; question: string; result: RafiqResult | null; shared?: SharedPost };

export function poseFor(result: RafiqResult | null): RafiqPose {
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

export /** The turns before a question, as the service reads them: what was asked and what Rafiq said. */
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

/** Rafiq's turn: his figure and name at the start side, what he says beside them. */
export function RafiqSays({
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
export function YouSaid({ children }: { children: string }) {
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

export function ExchangeView({
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
  return (
    <>
      {exchange.shared && (
        <li className="flex justify-end ps-12">
          <SharedPostQuote post={exchange.shared} className="max-w-full" />
        </li>
      )}
      <YouSaid>{exchange.question}</YouSaid>
      <RafiqReply id={`rafiq-${exchange.id}`} result={exchange.result} lessons={lessons} replyRef={replyRef} onRetry={onRetry} />
    </>
  );
}

/** Rafiq's turn for one question: thinking, his answer, or what went wrong and what to do. */
export function RafiqReply({
  id,
  result,
  lessons,
  replyRef,
  onRetry,
}: {
  id: string;
  result: RafiqResult | null;
  lessons?: Readonly<Record<string, LessonLink>>;
  replyRef?: (element: HTMLElement | null) => void;
  onRetry: () => void;
}) {
  const t = useTranslations("Rafiq");
  return (
    <RafiqSays pose={poseFor(result)} thinking={!result} articleRef={replyRef}>
      {!result ? (
        <p className="font-medium text-muted-foreground">{t("thinking")}</p>
      ) : result.kind === "answer" ? (
        <AnswerView answer={result.answer} id={id} lessons={lessons} />
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
  );
}
