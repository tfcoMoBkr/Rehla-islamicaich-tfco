"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { stopRecitation } from "./recitation";

/*
 * Read-aloud with the browser's own voices (SpeechSynthesis), sentence by sentence so the
 * sentence being read can be highlighted. Callers pass only text that may be read by a
 * synthetic voice: never Quran text, never the Arabic text of a hadith.
 */

export const READING_RATES = [1, 1.25, 0.75] as const;
const SPEECH_START = "rehla:speech-start";

/** Splits text after sentence-ending punctuation (Latin and Arabic) and at line breaks. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?؟…:])\s+|\n+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function subscribeToVoices(onChange: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", onChange);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", onChange);
}

function findVoice(lang: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith(lang));
  return voices.find((voice) => voice.localService) ?? voices[0] ?? null;
}

/** The device's voice for a language, or null (then the Listen button stays hidden). */
export function useVoice(lang: string): SpeechSynthesisVoice | null {
  const voiceName = useSyncExternalStore(
    subscribeToVoices,
    () => findVoice(lang)?.voiceURI ?? null,
    () => null,
  );
  return useMemo(() => (voiceName ? findVoice(lang) : null), [voiceName, lang]);
}

export function stopSpeech(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

export type ReadAloud = {
  supported: boolean;
  playing: boolean;
  /** Index of the segment being read, or null. */
  current: number | null;
  rate: (typeof READING_RATES)[number];
  toggle: () => void;
  cycleRate: () => void;
};

/** Reads `segments` aloud in order; pausing keeps the place, so play resumes from that segment. */
export function useReadAloud(segments: readonly string[], lang: string): ReadAloud {
  const voice = useVoice(lang);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);
  const [rate, setRate] = useState<(typeof READING_RATES)[number]>(1);
  const owner = useRef(Symbol("reader"));

  const stop = useCallback(() => {
    stopSpeech();
    setPlaying(false);
  }, []);

  const speakFrom = useCallback(
    (start: number, speed: number) => {
      if (!voice) return;
      stopSpeech();
      stopRecitation();
      window.dispatchEvent(new CustomEvent(SPEECH_START, { detail: owner.current }));
      segments.slice(start).forEach((text, offset) => {
        const index = start + offset;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.rate = speed;
        utterance.onstart = () => setCurrent(index);
        if (index === segments.length - 1) {
          utterance.onend = () => {
            setPlaying(false);
            setCurrent(null);
          };
        }
        window.speechSynthesis.speak(utterance);
      });
      setPlaying(true);
    },
    [segments, voice],
  );

  useEffect(() => {
    const onOtherStart = (event: Event) => {
      if ((event as CustomEvent<symbol>).detail !== owner.current) setPlaying(false);
    };
    window.addEventListener(SPEECH_START, onOtherStart);
    return () => window.removeEventListener(SPEECH_START, onOtherStart);
  }, []);

  // Leaving the screen stops this reader.
  useEffect(() => () => stopSpeech(), []);

  return {
    supported: voice !== null && segments.length > 0,
    playing,
    current: playing ? current : null,
    rate,
    toggle: () => (playing ? stop() : speakFrom(current ?? 0, rate)),
    cycleRate: () => {
      const next = READING_RATES[(READING_RATES.indexOf(rate) + 1) % READING_RATES.length] ?? 1;
      setRate(next);
      if (playing) speakFrom(current ?? 0, next);
    },
  };
}
