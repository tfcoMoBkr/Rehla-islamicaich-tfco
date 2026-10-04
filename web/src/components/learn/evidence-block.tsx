import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

import type { EvidenceView } from "@/lib/learn/types";

/**
 * A card's evidence, verbatim from its source. A verse is shown in Arabic (with the approved
 * translation in English); a hadith in the learner's language when the source has it, and
 * otherwise only its citation.
 */
export function EvidenceBlock({ evidence }: { evidence: EvidenceView }) {
  const t = useTranslations("Lesson");

  if (evidence.kind === "quran") {
    return (
      <figure className="grid gap-3 rounded-2xl border border-dawn/40 bg-dawn/6 p-5">
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
        {evidence.url && (
          <a href={evidence.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 justify-self-start text-sm underline underline-offset-4">
            {evidence.attribution}
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
        )}
      </figure>
    );
  }

  return (
    <figure className="grid gap-3 rounded-2xl border border-oasis/30 bg-oasis/6 p-5">
      <figcaption className="text-sm font-medium text-muted-foreground">{t("evidenceHadith")}</figcaption>
      {evidence.hadith ? (
        <>
          <blockquote className="text-lg leading-relaxed">{evidence.hadith.text}</blockquote>
          <p className="text-sm">
            <span className="font-semibold">{evidence.hadith.grade}</span> · {evidence.hadith.attribution}
          </p>
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer font-medium">{t("explanation")}</summary>
            <p className="mt-2 leading-relaxed">{evidence.hadith.explanation}</p>
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
