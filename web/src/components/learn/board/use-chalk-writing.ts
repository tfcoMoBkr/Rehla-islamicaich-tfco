"use client";

import { useEffect, useRef, useState } from "react";

import { playChalk } from "@/lib/audio/natural-sounds";
import { useReadAloud, type ReadAloud } from "@/lib/audio/speech";

/** How long each word takes to appear when the board writes at its own pace. */
const WORD_MS = 120;
/** A spoken word takes about this long at normal speed, so writing keeps pace with the voice. */
const SPOKEN_WORD_MS = 330;
const LINE_PAUSE_MS = 350;

export const wordsIn = (line: string) => line.split(/\s+/).filter(Boolean).length;

type ChalkWritingOptions = {
  lines: readonly string[];
  locale: string;
  /** Write everything at once: when reduced motion is asked for, or when the board is revisited. */
  instant: boolean;
  sounds: boolean;
};

export type ChalkWriting = {
  /** Lines before this index are written; the line at it, if any, is being written. */
  cursor: number;
  done: boolean;
  wordMs: number;
  /** One tap writes the whole board. */
  complete: () => void;
  /** The Listen voice for these lines. While it reads a line, that line is the one being written. */
  reader: ReadAloud;
};

/**
 * Writes a board line by line, at its own pace or in step with the voice reading it aloud.
 * Only for text a synthetic voice may read: never Quran text or a hadith's Arabic text.
 */
export function useChalkWriting({ lines, locale, instant, sounds }: ChalkWritingOptions): ChalkWriting {
  const [ownCursor, setOwnCursor] = useState(0);
  const reader = useReadAloud(lines, locale, {
    onSegmentStart: (index) => setOwnCursor((current) => Math.max(current, index)),
  });
  const stopChalk = useRef<() => void>(() => {});

  const cursor = instant ? lines.length : ownCursor;
  const done = cursor >= lines.length;
  const following = reader.playing && reader.current !== null;
  const wordMs = following ? Math.round(SPOKEN_WORD_MS / reader.rate) : WORD_MS;

  // At its own pace, the board moves to the next line once this one is written.
  useEffect(() => {
    if (done || following) return;
    const timer = window.setTimeout(
      () => setOwnCursor(cursor + 1),
      wordsIn(lines[cursor] ?? "") * wordMs + LINE_PAUSE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [cursor, done, following, lines, wordMs]);

  useEffect(() => {
    stopChalk.current();
    if (done || !sounds) return;
    stopChalk.current = playChalk(wordsIn(lines[cursor] ?? "") * wordMs);
  }, [cursor, done, sounds, lines, wordMs]);

  useEffect(() => () => stopChalk.current(), []);

  return {
    cursor,
    done,
    wordMs,
    reader,
    complete: () => {
      stopChalk.current();
      setOwnCursor(lines.length);
    },
  };
}
