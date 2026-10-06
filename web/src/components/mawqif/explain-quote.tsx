"use client";

import { HelpCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState, type FormEvent } from "react";

import { AnswerView } from "@/components/rafiq/answer-view";
import { RafiqReply, YouSaid } from "@/components/rafiq/thread";
import { Button } from "@/components/ui/button";
import { explainQuote } from "@/lib/mawqif/practice";
import type { ItemView, QuoteView } from "@/lib/mawqif/types";
import type { RafiqResult } from "@/lib/rafiq/answer";
import { replyText } from "@/lib/rafiq/answer";
import type { Turn } from "@/lib/rafiq/ask";

import { QuoteCard, SourceInFull } from "./quote";

// Rafiq's plain explanation of each quote, kept for this visit so returning to a screen asks nothing.
const explained = new Map<string, Promise<RafiqResult>>();

function firstExplanation(situationId: string, quote: QuoteView, locale: "ar" | "en"): Promise<RafiqResult> {
  const key = `${situationId}:${quote.ref}:${locale}`;
  let pending = explained.get(key);
  if (!pending) {
    pending = explainQuote({ situationId, quoteRef: quote.ref, locale, mode: "explain" });
    explained.set(key, pending);
    // A failed explanation is asked for again next time.
    void pending.then((result) => result.kind !== "answer" && explained.delete(key));
  }
  return pending;
}

type Exchange = { id: number; question: string; result: RafiqResult | null };

/**
 * One quote of a situation: the exact words and their source; for the words to say, Rafiq's plain
 * explanation of them (written at run time from the sources, under his checks). "I don't
 * understand, explain it" opens Rafiq here, on this quote, for as long as the learner wants.
 */
export function ExplainQuote({
  situationId,
  quote,
  item,
  explainNow = false,
}: {
  situationId: string;
  quote: QuoteView;
  item?: ItemView;
  /** Explain it as soon as it is shown (the words to say); otherwise only on request. */
  explainNow?: boolean;
}) {
  const t = useTranslations("Mawqif");
  const locale = useLocale() as "ar" | "en";
  const inputId = useId();
  const [first, setFirst] = useState<RafiqResult | null>(null);
  const [open, setOpen] = useState(false);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [draft, setDraft] = useState("");
  const wanted = explainNow || open;

  useEffect(() => {
    if (!wanted) return;
    let current = true;
    void firstExplanation(situationId, quote, locale).then((result) => current && setFirst(result));
    return () => {
      current = false;
    };
  }, [wanted, situationId, quote, locale]);

  const busy = exchanges.some((exchange) => exchange.result === null);

  async function ask(question: string, mode: "simpler" | "question") {
    const id = exchanges.length + 1;
    const history: Turn[] = [];
    if (first?.kind === "answer") history.push({ role: "assistant", text: replyText(first.answer) });
    for (const exchange of exchanges) {
      if (exchange.result?.kind !== "answer") continue;
      history.push({ role: "user", text: exchange.question }, { role: "assistant", text: replyText(exchange.result.answer) });
    }
    setExchanges((list) => [...list, { id, question, result: null }]);
    const result = await explainQuote({ situationId, quoteRef: quote.ref, locale, mode, ...(mode === "question" ? { question } : {}), history });
    setExchanges((list) => list.map((exchange) => (exchange.id === id ? { ...exchange, result } : exchange)));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || busy) return;
    setDraft("");
    void ask(question, "question");
  }

  return (
    <div className="grid gap-3">
      <QuoteCard quote={quote} />
      {wanted && (
        <div className="grid gap-2 ps-2">
          {first === null && (
            <p role="status" className="text-sm text-muted-foreground">
              {t("explaining")}
            </p>
          )}
          {first?.kind === "answer" && <AnswerView answer={first.answer} id={`explain-${quote.ref}`} />}
          {first && first.kind !== "answer" && <p className="text-sm text-muted-foreground">{t("explainUnavailable")}</p>}
        </div>
      )}
      {item && <SourceInFull item={item} />}

      {!open ? (
        <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setOpen(true)}>
          <HelpCircle aria-hidden />
          {t("dontUnderstand")}
        </Button>
      ) : (
        <section aria-label={t("askAboutQuote")} className="grid gap-4 rounded-2xl border border-hairline bg-sand/60 p-4">
          {exchanges.length > 0 && (
            <ol className="grid gap-4">
              {exchanges.map((exchange) => (
                <ExplainExchange
                  key={exchange.id}
                  exchange={exchange}
                  quoteRef={quote.ref}
                  onRetry={() => void ask(exchange.question, exchange.question === t("explainSimpler") ? "simpler" : "question")}
                />
              ))}
            </ol>
          )}
          <form onSubmit={submit} className="grid gap-2">
            <label htmlFor={inputId} className="font-semibold">
              {t("askAboutQuote")}
            </label>
            <textarea
              id={inputId}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={2}
              maxLength={500}
              dir="auto"
              placeholder={t("askQuotePlaceholder")}
              className="w-full rounded-xl border-2 border-border bg-card p-3 text-lg leading-relaxed placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy || !draft.trim()}>
                {t("ask")}
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => void ask(t("explainSimpler"), "simpler")}>
                {t("explainSimpler")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t("backToSituation")}
              </Button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

function ExplainExchange({ exchange, quoteRef, onRetry }: { exchange: Exchange; quoteRef: string; onRetry: () => void }) {
  return (
    <li>
      <ol className="grid gap-3">
        <YouSaid>{exchange.question}</YouSaid>
        <RafiqReply id={`explain-${quoteRef}-${exchange.id}`} result={exchange.result} onRetry={onRetry} />
      </ol>
    </li>
  );
}
