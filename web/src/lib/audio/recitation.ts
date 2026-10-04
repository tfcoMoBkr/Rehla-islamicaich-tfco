"use client";

import { useSyncExternalStore } from "react";

import type { RecitationSpan } from "@/lib/learn/types";

/*
 * Real Quran recitation (mp3quran.net): one shared player plays a single ayah's span of the
 * surah recording, so only one ayah is ever heard at a time.
 */

let audio: HTMLAudioElement | null = null;
let playingId: string | null = null;
let stopAt: number | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function player(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.preload = "none";
    audio.addEventListener("timeupdate", () => {
      if (audio && stopAt !== null && audio.currentTime * 1000 >= stopAt) stopRecitation();
    });
    audio.addEventListener("ended", stopRecitation);
  }
  return audio;
}

export function stopRecitation(): void {
  audio?.pause();
  playingId = null;
  stopAt = null;
  notify();
}

function play(id: string, span: RecitationSpan, onStart: () => void): void {
  const element = player();
  onStart();
  if (element.src !== span.audioUrl) element.src = span.audioUrl;
  const begin = () => {
    element.currentTime = span.start / 1000;
    void element.play().catch(stopRecitation);
  };
  if (element.readyState >= 1) begin();
  else element.addEventListener("loadedmetadata", begin, { once: true });
  playingId = id;
  stopAt = span.end;
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether this ayah is playing, and a toggle that plays only its span of the recitation. */
export function useRecitation(id: string, span: RecitationSpan | null, onStart: () => void) {
  const playing = useSyncExternalStore(subscribe, () => playingId === id, () => false);
  return {
    available: span !== null,
    playing,
    toggle: () => {
      if (!span) return;
      if (playing) stopRecitation();
      else play(id, span, onStart);
    },
  };
}
