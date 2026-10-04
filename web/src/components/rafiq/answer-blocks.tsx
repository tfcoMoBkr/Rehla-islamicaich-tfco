"use client";

import { ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

import type { HadithAnswerBlock, QuranAnswerBlock } from "@/lib/rafiq/answer";
import { inLanguage, type AnswerLanguage } from "@/lib/rafiq/languages";
import { cn } from "@/lib/utils";

/** Published texts longer than this start collapsed, with "show all". */
const COLLAPSE_FROM = 420;

export function Marker({ n, id, className }: { n: number; id: string; className?: string }) {
  const t = useTranslations("Rafiq");
  return (
    <a
      href={`#${id}-source-${n}`}
      aria-label={t("sourceMarker", { n })}
      className={cn(
        "ms-0.5 inline-grid min-w-[1.1rem] place-items-center rounded-md bg-dawn/20 px-1 align-super text-[0.7rem] leading-4 font-semibold text-ink no-underline hover:bg-dawn/40",
        className,
      )}
    >
      {n}
    </a>
  );
}

/**
 * A published text, exactly as it arrived: never trimmed, retyped or normalised. A long one is
 * clamped by CSS (the whole text stays in the page) until the reader asks for all of it.
 */
function PublishedText({
  text,
  language,
  kind,
  className,
}: {
  text: string;
  language: AnswerLanguage;
  kind: string;
  className?: string;
}) {
  const t = useTranslations("Rafiq");
  const textId = useId();
  const long = text.length > COLLAPSE_FROM;
  const [open, setOpen] = useState(false);
  const { lang, dir, className: script } = inLanguage(language);
  return (
    <div className="grid gap-1.5">
      <p
        id={textId}
        lang={lang}
        dir={dir}
        data-published={kind}
        className={cn("whitespace-pre-line", script, className, long && !open && "line-clamp-6")}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={textId}
          onClick={() => setOpen((value) => !value)}
          className="justify-self-start text-sm font-semibold underline underline-offset-4"
        >
          {open ? t("showLess") : t("showAll")}
        </button>
      )}
    </div>
  );
}

/** `lang` and `dir` only, for a short label inside a line of interface text. */
function direction(language: AnswerLanguage): { lang: string; dir: "rtl" | "ltr" } {
  const { lang, dir } = inLanguage(language);
  return { lang, dir };
}

function useLanguageName(): (language: AnswerLanguage) => string {
  const locale = useLocale();
  const names = new Intl.DisplayNames([locale], { type: "language" });
  return (language) => names.of(language) ?? language;
}

/** Says when a translation is in another language than the answer, because none is published. */
function FallbackNote({ shown, wanted, message }: { shown: AnswerLanguage; wanted: AnswerLanguage; message: "verse" | "hadith" }) {
  const t = useTranslations("Rafiq");
  const name = useLanguageName();
  if (shown === wanted) return null;
  const values = { language: name(wanted), fallback: name(shown) };
  return <p className="text-sm text-muted-foreground">{message === "verse" ? t("verseFallback", values) : t("hadithFallback", values)}</p>;
}

function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 justify-self-start text-sm underline underline-offset-4">
      {children}
      <ExternalLink aria-hidden className="size-3.5" />
    </a>
  );
}

/** A verse: the Arabic as QuranEnc publishes it, its surah and ayah, then the published translation. */
export function QuranBlockView({ block, id, language }: { block: QuranAnswerBlock; id: string; language: AnswerLanguage }) {
  const t = useTranslations("Rafiq");
  const translated = block.translationLanguage ?? language;
  return (
    <figure className="grid gap-3 rounded-2xl border border-dawn/40 bg-dawn/6 p-5">
      <figcaption className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-muted-foreground">
        {block.surahName ? (
          t.rich("surahAyah", {
            surah: () => <span {...direction(language)}>{block.surahName}</span>,
            ayah: block.ayah,
          })
        ) : (
          <span dir="ltr">{block.ref}</span>
        )}
        <Marker n={block.n} id={id} className="align-baseline" />
      </figcaption>
      <PublishedText text={block.arabic} language="ar" kind="arabic" className="font-quran text-2xl leading-[2.3] text-ink" />
      {block.translation && (
        <div className="grid gap-1">
          <PublishedText text={block.translation} language={translated} kind="translation" className="text-ink/85" />
          {block.translationName && (
            <p className="text-sm text-muted-foreground">
              {t("translationBy", { name: block.translationName, version: block.translationVersion ?? "—" })}
            </p>
          )}
          <FallbackNote shown={translated} wanted={language} message="verse" />
        </div>
      )}
      <SourceLink href={block.url}>QuranEnc.com</SourceLink>
    </figure>
  );
}

/**
 * A hadith: the Arabic as HadeethEnc publishes it, then its published translation, grade and
 * attribution, and (in extractive answers) HadeethEnc's own explanation, attributed to it.
 */
export function HadithBlockView({ block, id, language }: { block: HadithAnswerBlock; id: string; language: AnswerLanguage }) {
  const t = useTranslations("Rafiq");
  const lesson = useTranslations("Lesson");
  const translated = block.textLanguage ?? language;
  return (
    <figure className="grid gap-3 rounded-2xl border border-oasis/30 bg-oasis/6 p-5">
      <figcaption className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {lesson("evidenceHadith")}
        <Marker n={block.n} id={id} className="align-baseline" />
      </figcaption>
      <PublishedText text={block.arabic} language="ar" kind="arabic" className="text-lg text-ink" />
      {block.text && (
        <div className="grid gap-1">
          <PublishedText text={block.text} language={translated} kind="translation" className="text-lg text-ink/85" />
          <FallbackNote shown={translated} wanted={language} message="hadith" />
        </div>
      )}
      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {block.grade && (
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">{lesson("hadithGrade")}</dt>
            <dd className="font-semibold" {...direction(translated)}>
              {block.grade}
            </dd>
          </div>
        )}
        {block.attribution && (
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">{lesson("hadithAttribution")}</dt>
            <dd {...direction(translated)}>{block.attribution}</dd>
          </div>
        )}
      </dl>
      {block.explanation && (
        <blockquote className="grid gap-1.5 border-s-2 border-oasis/40 ps-3">
          <p className="text-sm font-semibold text-muted-foreground">{t("explanationBy")}</p>
          <PublishedText text={block.explanation} language={translated} kind="explanation" />
        </blockquote>
      )}
      <SourceLink href={block.url}>HadeethEnc.com</SourceLink>
    </figure>
  );
}
