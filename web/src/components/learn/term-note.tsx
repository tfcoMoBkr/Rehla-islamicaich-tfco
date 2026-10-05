import { useTranslations } from "next-intl";

import type { TermView } from "@/lib/learn/types";

/** A term the card uses, opened to show its definition exactly as TerminologyEnc publishes it. */
export function TermNote({ term }: { term: TermView }) {
  const t = useTranslations("Lesson");
  return (
    <details className="group rounded-xl border border-border bg-card">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 py-2 font-semibold">
        <span className="rounded-full bg-dawn/20 px-2 py-0.5 text-xs">{t("termLabel")}</span>
        {term.word}
      </summary>
      <div className="grid gap-2 px-4 pb-4 leading-relaxed">
        <p className="text-lg font-semibold">{term.title}</p>
        {term.definition && <p>{term.definition}</p>}
        {term.explanation && <p className="whitespace-pre-line text-muted-foreground">{term.explanation}</p>}
        <a href={term.url} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-4">
          {t("termSource")}
        </a>
      </div>
    </details>
  );
}
