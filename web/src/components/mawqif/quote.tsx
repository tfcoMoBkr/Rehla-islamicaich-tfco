"use client";

import { ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { EvidenceBlock } from "@/components/learn/evidence-block";
import { parts } from "@/config/features";
import type { ItemView, PartView, QuoteView, SourceLabel } from "@/lib/mawqif/types";
import { cn } from "@/lib/utils";

import { ListenButton } from "./listen-button";

/** Where a quote comes from, in one line, with a link to the publisher. */
export function SourceLine({ source, className }: { source: SourceLabel; className?: string }) {
  const t = useTranslations("Mawqif");
  const label =
    source.kind === "hadith"
      ? t("sourceHadith", { citation: source.citation, grade: source.grade ?? t("gradeUnknown") })
      : source.kind === "quran"
        ? t("sourceQuran", { ref: source.ref })
        : source.title;
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      {source.url ? (
        <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 underline underline-offset-4 hover:text-foreground">
          <span dir="auto">{label}</span>
          <ExternalLink aria-hidden className="size-3.5 shrink-0" />
        </a>
      ) : (
        <span dir="auto">{label}</span>
      )}
    </p>
  );
}

/**
 * Exact words of a source, set apart from the team's wording, with the source named under them. A
 * phrase to say is taught in Arabic whatever the interface language: on an English page its Arabic,
 * an approximate pronunciation and the published translation as its meaning; on both, "listen".
 */
export function QuoteCard({ quote, className }: { quote: QuoteView; className?: string }) {
  const t = useTranslations("Mawqif");
  const locale = useLocale();
  const verse = quote.source.kind === "quran";
  const say = parts.phraseAids ? quote.say : undefined;
  const arabicFirst = say && locale !== "ar";
  return (
    <figure className={cn("grid gap-2 rounded-2xl border border-dawn/40 border-s-4 border-s-dawn bg-paper p-4", className)}>
      {arabicFirst && (
        <div className="grid gap-1">
          <p lang="ar" dir="rtl" className={cn("text-xl leading-loose", verse && "font-quran text-2xl")}>
            {say.arabic}
          </p>
          {say.pronunciation && (
            <p className="text-sm">
              <span className="font-semibold text-muted-foreground">{t("approxPronunciation")}: </span>
              <span lang="ar-Latn">{say.pronunciation}</span>
            </p>
          )}
          <p className="text-sm font-semibold text-muted-foreground">{t("meaningPublished")}</p>
        </div>
      )}
      <blockquote dir="auto" className={cn("text-lg leading-loose", verse && !arabicFirst && "font-quran text-xl")}>
        {quote.text}
      </blockquote>
      {say && !verse && <ListenButton text={say.arabic} />}
      <figcaption>
        <SourceLine source={quote.source} />
      </figcaption>
    </figure>
  );
}

/** A source in full, opened on request: the verse or hadith as published, or the book passage. */
export function SourceInFull({ item }: { item: ItemView }) {
  const t = useTranslations("Mawqif");
  const locale = useLocale();
  return (
    <details className="group rounded-2xl border border-hairline bg-paper px-4 py-3">
      <summary className="cursor-pointer py-1 text-sm font-semibold">
        {t("readWholeSource")} · <SourceLabelText source={item.source} />
      </summary>
      <div className="mt-3">
        {item.evidence ? (
          <EvidenceBlock evidence={item.evidence} />
        ) : (
          <div className="grid gap-2">
            <p lang={locale} className="leading-loose">
              {item.bookText}
            </p>
            <SourceLine source={item.source} />
          </div>
        )}
      </div>
    </details>
  );
}

function SourceLabelText({ source }: { source: SourceLabel }) {
  const t = useTranslations("Mawqif");
  if (source.kind === "hadith") return <>{t("sourceHadithShort", { citation: source.citation })}</>;
  if (source.kind === "quran") return <>{t("sourceQuran", { ref: source.ref })}</>;
  return <>{source.title}</>;
}

/** A line of the role-play: the team's words as they are, quoted words marked as quotes. */
export function Parts({ parts }: { parts: readonly PartView[] }) {
  return (
    <span className="grid gap-1.5">
      {parts.map((part, index) =>
        part.kind === "text" ? (
          <span key={index}>{part.text}</span>
        ) : (
          <q key={index} dir="auto" className={cn("font-semibold", part.quote.source.kind === "quran" && "font-quran text-lg")}>
            {part.quote.text}
          </q>
        ),
      )}
    </span>
  );
}
