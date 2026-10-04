"use client";

import { useSyncExternalStore } from "react";

import type { RecitationSpan } from "@/lib/learn/types";

/*
 * Real Quran recitation (mp3quran.net): one shared player plays a single ayah's span of the
 * surah recording, so only one ayah is ever heard at a time.
 */

export type RecitationStatus = "idle" | "loading" | "playing" | "error";

let audio: HTMLAudioElement | null = null;
let currentId: string | null = null;
let status: RecitationStatus = "idle";
let span: RecitationSpan | null = null;
/** True until the player has reached the ayah's start; it stays muted until then. */
let seeking = false;
const listeners = new Set<() => void>();

function set(next: RecitationStatus) {
  status = next;
  listeners.forEach((listener) => listener());
}

function fail() {
  audio?.pause();
  seeking = false;
  set("error");
}

function player(): HTMLAudioElement {
  if (audio) return audio;
  const element = new Audio();
  element.addEventListener("timeupdate", () => {
    if (span && !seeking && element.currentTime * 1000 >= span.end) stopRecitation();
  });
  element.addEventListener("seeked", () => {
    if (!seeking) return;
    seeking = false;
    element.muted = false;
    if (currentId && !element.paused) set("playing");
  });
  element.addEventListener("playing", () => {
    if (currentId && !seeking) set("playing");
  });
  element.addEventListener("ended", stopRecitation);
  element.addEventListener("error", () => {
    if (currentId) fail();
  });
  audio = element;
  return element;
}

export function stopRecitation(): void {
  audio?.pause();
  seeking = false;
  currentId = null;
  span = null;
  set("idle");
}

/** Called from the tap itself, so that play() runs inside the user gesture. */
function play(id: string, target: RecitationSpan, onStart: () => void): void {
  const element = player();
  onStart();
  element.pause();
  currentId = id;
  span = target;
  seeking = true;
  element.muted = true;
  set("loading");

  if (element.src !== target.audioUrl) {
    element.src = target.audioUrl;
    element.load();
  }
  const seek = () => {
    if (currentId !== id) return;
    element.currentTime = target.start / 1000;
  };
  if (element.readyState >= HTMLMediaElement.HAVE_METADATA) seek();
  else element.addEventListener("loadedmetadata", seek, { once: true });

  element.play().then(
    () => {
      // Already at the ayah's start (no seek needed): unmute and report as playing.
      if (currentId === id && Math.abs(element.currentTime * 1000 - target.start) < 250) {
        seeking = false;
        element.muted = false;
        set("playing");
      }
    },
    () => {
      if (currentId === id) fail();
    },
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** This ayah's playback state, and a toggle that plays only its span of the recitation. */
export function useRecitation(id: string, target: RecitationSpan | null, onStart: () => void) {
  const state = useSyncExternalStore(
    subscribe,
    () => (currentId === id ? status : "idle"),
    () => "idle" as const,
  );
  return {
    available: target !== null,
    status: state,
    toggle: () => {
      if (!target) return;
      if (state === "playing" || state === "loading") stopRecitation();
      else play(id, target, onStart);
    },
  };
}
