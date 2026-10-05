import { useSyncExternalStore } from "react";

import { textStore } from "@/lib/device-store";

/*
 * The first-visit guide: shown once on this device until it is finished or skipped, and again
 * whenever the learner asks for it ("How Rehla works"). Nothing about it leaves the device.
 */

const seen = textStore("rehla.guide.v1");
let replaying = false;
// Asked for by the learner (a replay), rather than shown on a first visit.
let askedFor = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const unsubscribe = seen.subscribe(listener);
  return () => {
    listeners.delete(listener);
    unsubscribe();
  };
}

/** Whether the guide shows: never seen on this device, or asked for again. */
export const guideVisible = () => replaying || seen.read() === null;

/** Never on the server or the first render, so a returning visitor never sees it flash. */
export const useGuideVisible = () => useSyncExternalStore(subscribe, guideVisible, () => false);

export function replayGuide(): void {
  replaying = true;
  askedFor = true;
  listeners.forEach((listener) => listener());
}

export function closeGuide(): void {
  replaying = false;
  seen.set("seen");
  listeners.forEach((listener) => listener());
}

export const wasAskedFor = () => askedFor;
