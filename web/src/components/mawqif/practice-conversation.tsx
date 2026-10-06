"use client";

import { Lightbulb, LifeBuoy, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useState, type FormEvent } from "react";

import { RafiqFigure } from "@/components/rafiq/rafiq-figure";
import { ReferralCard } from "@/components/rafiq/referral-card";
import { RafiqReply } from "@/components/rafiq/thread";
import { SpecialistCard } from "@/components/specialists/specialist-card";
import { Button } from "@/components/ui/button";
import { PRACTICE_REPLY_MAX, startScene, takeTurn, type Line, type Scene } from "@/lib/mawqif/practice";
import { keyPointsOf } from "@/lib/mawqif/conversation";
import type { PartView, SituationView } from "@/lib/mawqif/types";
import { askRafiq } from "@/lib/rafiq/ask";
import type { RafiqResult } from "@/lib/rafiq/answer";

import { QuoteCard } from "./quote";

export type ConversationResult = { scene: Scene; history: Line[]; met: string[] };

type Pause =
  | { kind: "question"; question: string; result: RafiqResult | null }
  | { kind: "ruling" }
  | { kind: "care"; danger: boolean };

type Phase = { kind: "setting" } | { kind: "talking"; scene: Scene } | { kind: "unavailable" };

const textOf = (parts: PartView[]) => parts.map((part) => (part.kind === "text" ? part.text : part.quote.text)).join(" ");

/**
 * Practice as a real conversation: the AI plays someone in a fresh scene, the learner writes
 * freely, and Rafiq stays beside them as coach. A religious question pauses the scene for Rafiq's
 * answer; a ruling on their own case or anything hard brings the specialist card. When the service
 * is unavailable, `onUnavailable` hands over to the written replies.
 */
export function PracticeConversation({
  situation,
  minReplies,
  maxReplies,
  avoid,
  onFinished,
  onUnavailable,
}: {
  situation: SituationView;
  minReplies: number;
  maxReplies: number;
  avoid: string[];
  onFinished: (result: ConversationResult) => void;
  onUnavailable: () => void;
}) {
  const t = useTranslations("Mawqif");
  const locale = useLocale() as "ar" | "en";
  const inputId = useId();
  const hintId = useId();
  const [phase, setPhase] = useState<Phase>({ kind: "setting" });
  const [history, setHistory] = useState<Line[]>([]);
  const [met, setMet] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [ended, setEnded] = useState(false);
  const [pause, setPause] = useState<Pause | null>(null);
  const [help, setHelp] = useState<"none" | "help" | "hint">("none");
  const [problem, setProblem] = useState<"rateLimited" | null>(null);
  const points = useMemo(() => keyPointsOf(situation), [situation]);
  const replies = history.filter((line) => line.role === "learner").length;

  useEffect(() => {
    let current = true;
    void startScene({ situationId: situation.id, locale, avoid }).then((result) => {
      if (!current) return;
      if (result.status === "ready" && "scene" in result && result.scene) setPhase({ kind: "talking", scene: result.scene });
      else setPhase({ kind: "unavailable" });
    });
    return () => {
      current = false;
    };
    // A new scene only when the situation changes; `avoid` is read once, at the start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situation.id, locale]);

  if (phase.kind === "setting") {
    return (
      <p role="status" className="text-muted-foreground">
        {t("settingUp")}
      </p>
    );
  }
  if (phase.kind === "unavailable") {
    return (
      <div className="grid gap-3">
        <p role="alert" className="rounded-xl border border-dawn/50 bg-dawn/8 px-4 py-3">
          {t("conversationFallback")}
        </p>
        <Button className="justify-self-start" onClick={onUnavailable}>
          {t("next")}
        </Button>
      </div>
    );
  }

  const scene = phase.scene;
  const finish = () => onFinished({ scene, history, met });

  async function send(event: FormEvent) {
    event.preventDefault();
    const reply = draft.trim();
    if (!reply || sending) return;
    setSending(true);
    setProblem(null);
    setHelp("none");
    const result = await takeTurn({ situationId: situation.id, locale, scene, history, reply });
    setSending(false);
    if (result.status === "rateLimited") return setProblem("rateLimited");
    if (result.status === "unavailable" || result.status === "unknownSituation") return setPhase({ kind: "unavailable" });
    if (result.status === "question") {
      setDraft("");
      setPause({ kind: "question", question: reply, result: null });
      const answer = await askRafiq({ question: reply, locale }).catch((): RafiqResult => ({ kind: "error" }));
      return setPause({ kind: "question", question: reply, result: answer });
    }
    if (result.status === "ruling") return setPause({ kind: "ruling" });
    if (result.status === "distress" || result.status === "danger") return setPause({ kind: "care", danger: result.status === "danger" });
    const lines: Line[] = [...history, { role: "learner", text: reply }];
    if ("line" in result && result.line) lines.push({ role: "character", text: result.line });
    setHistory(lines);
    setMet((current) => [...new Set([...current, ...("met" in result ? result.met : [])])]);
    setDraft("");
    const count = lines.filter((line) => line.role === "learner").length;
    if (count >= maxReplies) onFinished({ scene, history: lines, met: [...new Set([...met, ...("met" in result ? result.met : [])])] });
    else if (result.status === "ended") setEnded(true);
  }

  const missing = points.find((point) => !met.includes(point.id));
  const hints = situation.exchanges[replies % Math.max(situation.exchanges.length, 1)]?.choices.filter((choice) => choice.quality !== "avoid") ?? [];

  return (
    <div className="grid gap-6">
      <div className="grid gap-1 rounded-2xl border border-hairline bg-sand/60 p-4">
        <p className="font-semibold">{[scene.person, scene.place].filter(Boolean).join(" · ")}</p>
        <p dir="auto" className="leading-relaxed">
          {scene.setting}
        </p>
      </div>

      <ol aria-label={t("conversation")} className="grid gap-4">
        <CharacterLine person={scene.person} text={scene.line} />
        {history.map((line, index) =>
          line.role === "character" ? (
            <CharacterLine key={index} person={scene.person} text={line.text} />
          ) : (
            <li key={index} className="flex justify-end">
              <div className="grid max-w-[85%] gap-1">
                <span className="text-end text-sm font-semibold text-muted-foreground">{t("you")}</span>
                <p dir="auto" className="rounded-2xl rounded-se-sm bg-ink px-4 py-3 text-lg leading-relaxed text-paper">
                  {line.text}
                </p>
              </div>
            </li>
          ),
        )}
        {sending && (
          <li role="status" className="text-sm text-muted-foreground">
            {t("replying", { person: scene.person || t("conversation") })}
          </li>
        )}
      </ol>

      {pause ? (
        <section className="grid gap-3 rounded-2xl border border-hairline bg-paper p-4">
          {pause.kind === "question" && (
            <>
              <h3 className="font-semibold">{t("pausedTitle")}</h3>
              <ol className="grid gap-3">
                <RafiqReply id={`pause-${situation.id}`} result={pause.result} onRetry={() => setPause(null)} />
              </ol>
            </>
          )}
          {pause.kind === "ruling" && (
            <>
              <ReferralCard reason="personalCase" links={["/talk-to-a-specialist"]} />
              <SpecialistCard />
              <p>{t("rulingNote")}</p>
            </>
          )}
          {pause.kind === "care" && (
            <>
              <ReferralCard reason={pause.danger ? "danger" : "distress"} links={["/talk-to-a-specialist"]} />
              <SpecialistCard />
              <p>{t("careNote")}</p>
            </>
          )}
          <Button className="justify-self-start" variant="outline" onClick={() => setPause(null)}>
            {t("resume")}
          </Button>
        </section>
      ) : (
        <form onSubmit={send} className="grid gap-3 rounded-3xl border border-hairline bg-paper p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <RafiqFigure pose="encouraging" height={64} decorative className="h-14 w-auto shrink-0" />
            <label htmlFor={inputId} className="font-semibold">
              {t("replyLabel")}
            </label>
          </div>
          <textarea
            id={inputId}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            maxLength={PRACTICE_REPLY_MAX}
            dir="auto"
            aria-describedby={hintId}
            className="w-full rounded-xl border-2 border-border bg-card p-3 text-lg leading-relaxed focus-visible:border-primary focus-visible:outline-none"
          />
          <p id={hintId} className="text-xs text-muted-foreground">
            {t("replyHint")}
          </p>
          {problem && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {t("rateLimited")}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={sending || !draft.trim() || ended}>
              {t("send")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setHelp(help === "help" ? "none" : "help")} aria-expanded={help === "help"}>
              <LifeBuoy aria-hidden />
              {t("helpMe")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setHelp(help === "hint" ? "none" : "hint")} aria-expanded={help === "hint"}>
              <Lightbulb aria-hidden />
              {t("giveHint")}
            </Button>
            {(replies >= minReplies || ended) && (
              <Button type="button" variant="ghost" onClick={finish}>
                {t("endConversation")}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t("repliesSoFar", { count: replies })}</p>
          {help === "help" && missing && (
            <div className="grid gap-2">
              <p className="font-semibold">{t("helpLine")}</p>
              <QuoteCard quote={missing.quote} />
            </div>
          )}
          {help === "hint" && hints.length > 0 && (
            <div className="grid gap-2">
              <p className="font-semibold">{t("hintTitle")}</p>
              <ul className="grid gap-2">
                {hints.map((choice) => (
                  <li key={choice.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-hairline bg-sand/60 px-3 py-2">
                    <span dir="auto">{textOf(choice.reply)}</span>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(textOf(choice.reply))}>
                      {t("useThis")}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

function CharacterLine({ person, text }: { person: string; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-oasis/15 text-oasis-text">
        <UserRound className="size-5" />
      </span>
      <div className="grid max-w-[85%] gap-1">
        {person && <span className="text-sm font-semibold text-muted-foreground">{person}</span>}
        <p dir="auto" className="rounded-2xl rounded-ss-sm border border-hairline bg-paper px-4 py-3 text-lg leading-relaxed">
          {text}
        </p>
      </div>
    </li>
  );
}
