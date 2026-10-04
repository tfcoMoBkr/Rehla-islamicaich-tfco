"use client";

import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { PublishedName } from "@/components/learn/wording";

import { RecitationButton } from "@/components/learn/audio/recitation-button";
import type { AyahLine, AyahSet } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type AyahByAyahProps = {
  ayahs: AyahSet;
  onProgress: (opened: number) => void;
};

/**
 * Tap an ayah to open its meaning and hear it. The ayah text is shown exactly as fetched from
 * quranenc.com, in the Quran typeface, and heard only in its mp3quran.net recitation.
 */
export function AyahByAyah({ ayahs, onProgress }: AyahByAyahProps) {
  const t = useTranslations("Activity");
  const locale = useLocale();
  const [open, setOpen] = useState<string[]>([]);

  if (ayahs.lines.length === 0) {
    return (
      <p role="status" className="rounded-xl border border-dawn/50 bg-dawn/10 p-4">
        {t("ayahsUnavailable")}
      </p>
    );
  }

  function toggle(line: AyahLine) {
    const next = open.includes(line.id) ? open.filter((id) => id !== line.id) : [...open, line.id];
    setOpen(next);
    onProgress(new Set([...open, line.id]).size);
  }

  return (
    <div className="grid gap-3">
      <ol className="grid gap-3">
        {ayahs.lines.map((line) => {
          const expanded = open.includes(line.id);
          const panel = `ayah-${line.id.replace(":", "-")}`;
          return (
            <li key={line.id} className="rounded-2xl border border-hairline bg-paper">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panel}
                onClick={() => toggle(line)}
                className="flex w-full items-center gap-3 rounded-2xl p-4 text-start"
              >
                <span className="grid min-w-10 shrink-0 place-items-center rounded-full border border-dawn px-1.5 py-1 text-xs font-semibold" dir="ltr">
                  {line.ref}
                </span>
                <span lang="ar" dir="rtl" className="min-w-0 flex-1 font-quran text-2xl leading-[2.4] text-ink">
                  {line.text}
                </span>
                <ChevronDown aria-hidden className={cn("size-5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
              </button>
              <div id={panel} hidden={!expanded} className="grid gap-2 border-t border-dashed border-hairline p-4">
                {line.meaning && <p lang={locale}>{line.meaning}</p>}
                {line.translation && (
                  <p lang="en" className={cn(line.meaning && "text-sm text-muted-foreground")}>
                    {line.meaning && <span className="font-medium">{t("translation")}: </span>}
                    {line.translation}
                  </p>
                )}
                {line.footnotes && (
                  <details lang="en" className="text-sm text-muted-foreground">
                    <summary className="cursor-pointer">{t("footnotes")}</summary>
                    <p className="mt-1 whitespace-pre-line">{line.footnotes}</p>
                  </details>
                )}
                <RecitationButton
                  id={`ayah-${line.id}`}
                  span={line.audio && ayahs.audioUrl ? { audioUrl: ayahs.audioUrl, ...line.audio } : null}
                />
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-sm text-muted-foreground">
        {ayahs.published && (
          <span className="block">
            {t("meaningFrom")} <PublishedName published={ayahs.published} />
          </span>
        )}
        {t("quranFrom")} QuranEnc.com
        {ayahs.reciter && (
          <>
            {" · "}
            {t("recitationFrom")} <span lang="ar">{ayahs.reciter}</span> (mp3quran.net)
          </>
        )}
      </p>
    </div>
  );
}
