"use client";

import { ChevronDown, Pause, Play } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import type { AyahLine, AyahSet } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type AyahByAyahProps = {
  ayahs: AyahSet;
  onExplored: () => void;
};

/**
 * Tap an ayah to open its meaning and hear it. The ayah text is shown exactly as fetched from
 * quranenc.com, in the Quran typeface; audio plays that ayah's span of the mp3quran.net recitation.
 */
export function AyahByAyah({ ayahs, onExplored }: AyahByAyahProps) {
  const t = useTranslations("Activity");
  const locale = useLocale();
  const [open, setOpen] = useState<string[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const stopAt = useRef<number | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      if (stopAt.current !== null && audio.currentTime * 1000 >= stopAt.current) {
        audio.pause();
        stopAt.current = null;
        setPlaying(null);
      }
    };
    audio.addEventListener("timeupdate", onTime);
    return () => audio.removeEventListener("timeupdate", onTime);
  }, []);

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
    if (next.length === ayahs.lines.length) onExplored();
  }

  function play(line: AyahLine) {
    const audio = audioRef.current;
    if (!audio || !line.audio) return;
    if (playing === line.id) {
      audio.pause();
      setPlaying(null);
      return;
    }
    audio.currentTime = line.audio.start / 1000;
    stopAt.current = line.audio.end;
    setPlaying(line.id);
    void audio.play().catch(() => setPlaying(null));
  }

  return (
    <div className="grid gap-3">
      {ayahs.audioUrl && <audio ref={audioRef} src={ayahs.audioUrl} preload="none" />}
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
                {line.audio && ayahs.audioUrl && (
                  <button
                    type="button"
                    onClick={() => play(line)}
                    className="mt-1 inline-flex min-h-11 items-center gap-2 justify-self-start rounded-full border border-hairline px-4 text-sm font-medium hover:bg-accent"
                  >
                    {playing === line.id ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
                    {playing === line.id ? t("pause") : t("listen")}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-sm text-muted-foreground">
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
