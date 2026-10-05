"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef } from "react";

import { ListenControls } from "@/components/learn/audio/listen-controls";
import { EvidenceBlock } from "@/components/learn/evidence-block";
import { MediaGallery } from "@/components/learn/media-gallery";
import { SourceLinks } from "@/components/learn/source-links";
import { TermNote } from "@/components/learn/term-note";
import { TeamWordingLabel } from "@/components/learn/wording";
import { splitSentences, type ReadAloud } from "@/lib/audio/speech";
import type { CardView } from "@/lib/learn/types";

import { ChalkLines } from "./chalk-lines";
import { AskRafiqControl } from "./ask-rafiq-control";
import { PaperSlip } from "./paper-slip";
import { useChalkWriting } from "./use-chalk-writing";

type CardBoardProps = {
  card: CardView;
  /** Write it all at once: under reduced motion, or when the learner comes back to it. */
  instant: boolean;
  sounds: boolean;
  /** The learner has turned the voice on: each new board starts reading by itself. */
  narrate: boolean;
  onNarrateChange: (narrate: boolean) => void;
  onWritten: () => void;
  /** Ask Rafiq about the text on this board; absent while Rafiq is switched off. */
  onLineHelp?: (line: string) => void;
};

/**
 * One card as one board. Its text writes itself line by line, in step with the Listen voice when
 * it is on; one tap writes it all. A verse or hadith never appears word by word: it fades in
 * whole on a paper slip, before the text when the lesson puts the evidence first, after it otherwise.
 */
export function CardBoard({ card, instant, sounds, narrate, onNarrateChange, onWritten, onLineHelp }: CardBoardProps) {
  const t = useTranslations("Board");
  const locale = useLocale();
  const lines = useMemo(() => splitSentences(card.text ?? ""), [card.text]);
  const writing = useChalkWriting({ lines, locale, instant, sounds });
  const { reader } = writing;
  const started = useRef(false);

  useEffect(() => {
    if (!narrate || instant || started.current || !reader.supported) return;
    started.current = true;
    reader.toggle();
  }, [narrate, instant, reader]);

  useEffect(() => {
    if (writing.done) onWritten();
  }, [writing.done, onWritten]);

  const listen: ReadAloud = {
    ...reader,
    toggle: () => {
      onNarrateChange(!reader.playing);
      reader.toggle();
    },
  };

  return (
    <>
      {card.evidenceFirst && card.evidence && (
        <PaperSlip>
          <EvidenceBlock evidence={card.evidence} />
        </PaperSlip>
      )}
      <div onClick={writing.done ? undefined : writing.complete} className={writing.done ? undefined : "cursor-pointer"}>
        <ChalkLines
          lines={lines}
          cursor={writing.cursor}
          wordMs={writing.wordMs}
          reading={reader.current}
        />
      </div>
      <TeamWordingLabel wording={card.wording} />
      {onLineHelp && card.text && <AskRafiqControl onOpen={() => onLineHelp(card.text ?? "")} className="justify-self-start" />}
      <div className="flex flex-wrap items-center gap-2">
        <ListenControls reader={listen} />
        {!writing.done && (
          <button
            type="button"
            onClick={writing.complete}
            className="min-h-11 rounded-full px-3 text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {t("writeAll")}
          </button>
        )}
      </div>
      {writing.done && (
        <>
          <MediaGallery media={card.media} />
          {!card.evidenceFirst && card.evidence && (
            <PaperSlip>
              <EvidenceBlock evidence={card.evidence} />
            </PaperSlip>
          )}
          {card.terms.map((term) => (
            <TermNote key={term.id} term={term} />
          ))}
          <SourceLinks sources={card.sources} />
        </>
      )}
    </>
  );
}
