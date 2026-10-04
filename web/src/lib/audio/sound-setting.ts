"use client";

import { useSyncExternalStore } from "react";

/*
 * Whether the lesson board makes its sounds. The choice is remembered on this device only. Until
 * the learner chooses, sounds are on, except where the device asks for reduced motion.
 */

const KEY = "rehla:board-sounds";
const CHANGE = "rehla:board-sounds-change";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** The choice for this visit, for when the device refuses to store it. */
let chosen: "on" | "off" | null = null;

function stored(): "on" | "off" | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "on" || value === "off" ? value : chosen;
  } catch {
    return chosen;
  }
}

function soundsOn(): boolean {
  const choice = stored();
  if (choice) return choice === "on";
  return !window.matchMedia(REDUCED_MOTION).matches;
}

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(REDUCED_MOTION);
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
    media.removeEventListener("change", onChange);
  };
}

export function useBoardSounds(): boolean {
  return useSyncExternalStore(subscribe, soundsOn, () => false);
}

export function setBoardSounds(on: boolean): void {
  chosen = on ? "on" : "off";
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {}
  window.dispatchEvent(new Event(CHANGE));
}
