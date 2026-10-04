import { ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import type { EvidenceView } from "@/lib/learn/types";

import { ListenableText } from "./audio/listenable-text";
import { RecitationButton } from "./audio/recitation-button";

/**
 * A card's evidence, verbatim from its source. A verse is shown in Arabic (with the approved
 * translation in English) and heard only in its real recitation. A hadith is shown in the
 * learner's language when the source has it, otherwise only as its citation; its Arabic text is
 * never read by a synthetic voice, its explanation may be.
 */
export function EvidenceBlock({ evidence }: { evidence: EvidenceView }) {
  const t = useTranslations("Lesson");
  const locale = useLocale();

  if (evidence.kind === "quran") {
    return (
      <figure className="animate-rise-in grid gap-3 rounded-2xl border border-dawn/40 bg-dawn/6 p-5 [animation-delay:150ms]">
        <figcaption className="text-sm font-medium text-muted-foreground">
          {t("evidenceQuran")} <span dir="ltr">({evidence.ref})</span>
        </figcaption>
        {evidence.ayahs.length === 0 ? (
          <p className="text-muted-foreground">{t("evidenceNotFetched")}</p>
        ) : (
          evidence.ayahs.map((ayah) => (
            <div key={ayah.ref} className="grid gap-2">
              <blockquote lang="ar" dir="rtl" className="font-quran text-2xl leading-[2.3] text-ink">
                {ayah.arabic}
              </blockquote>
              <RecitationButton id={`evidence-${ayah.ref}`} span={ayah.recitation} />
              {ayah.translation && (
                <p lang="en" dir="ltr" className="text-muted-foreground">
                  {ayah.translation}
                </p>
              )}
              {ayah.footnotes && (
                <details lang="en" dir="ltr" className="text-sm text-muted-foreground">
                  <summary className="cursor-pointer">{t("footnotes")}</summary>
                  <p className="mt-1 whitespace-pre-line">{ayah.footnotes}</p>
                </details>
              )}
            </div>
          ))
        )}
        <p className="text-sm text-muted-foreground">
          {evidence.url && (
            <a href={evidence.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 underline underline-offset-4">
              {evidence.attribution}
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          )}
          {evidence.reciter && (
            <span className="block">
              {t("recitedBy")} <span lang="ar">{evidence.reciter}</span> (mp3quran.net)
            </span>
          )}
        </p>
      </figure>
    );
  }

  return (
    <figure className="animate-rise-in grid gap-3 rounded-2xl border border-oasis/30 bg-oasis/6 p-5 [animation-delay:150ms]">
      <figcaption className="text-sm font-medium text-muted-foreground">{t("evidenceHadith")}</figcaption>
      {evidence.hadith ? (
        <>
          {locale === "ar" ? (
            <blockquote className="text-lg leading-relaxed">{evidence.hadith.text}</blockquote>
          ) : (
            <blockquote>
              <ListenableText text={evidence.hadith.text} className="text-lg leading-relaxed" controlsClassName="mt-2" />
            </blockquote>
          )}
          <p className="text-sm">
            <span className="font-semibold">{evidence.hadith.grade}</span> · {evidence.hadith.attribution}
          </p>
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer font-medium">{t("explanation")}</summary>
            <div className="mt-2 grid gap-2">
              <ListenableText text={evidence.hadith.explanation} className="leading-relaxed" />
            </div>
          </details>
          <a href={evidence.hadith.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 justify-self-start text-sm underline underline-offset-4">
            HadeethEnc.com
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
        </>
      ) : (
        <p>
          <span lang="ar">{evidence.citation}</span>
          <span className="block text-sm text-muted-foreground">{t("citationOnly")}</span>
        </p>
      )}
    </figure>
  );
}
