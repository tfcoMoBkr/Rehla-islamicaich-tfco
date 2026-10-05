import { useSyncExternalStore } from "react";

import { accountsEnabled } from "@/config/accounts";
import { textStore } from "@/lib/device-store";

import { accountSummary, hasStoredSession } from "./session";

/*
 * The one-time choice between an account and guest use, offered the first time a visitor who is not
 * signed in opens a learning section. It is remembered on this device and kept on sign-out, like the
 * language; a guest can still create an account later from the header.
 */

export type Choice = "account" | "guest";

export const accountChoice = textStore("rehla.choice.v1");

/** The sections where learning starts; the choice is offered on the first visit to any of them. */
const SECTIONS = ["/learn", "/practice", "/rafiq"];

export const inLearningSection = (pathname: string): boolean =>
  SECTIONS.some((section) => pathname === section || pathname.startsWith(`${section}/`));

type Situation = { enabled: boolean; signedIn: boolean; chosen: boolean; pathname: string };

/** Only a visitor who is not signed in and has not chosen yet, in a learning section, when accounts exist. */
export const offersChoice = ({ enabled, signedIn, chosen, pathname }: Situation): boolean =>
  enabled && !signedIn && !chosen && inLearningSection(pathname);

/** The tour waits until the choice is made, so the two never open together. */
export const tourMayOpen = (tourWanted: boolean, choiceOpen: boolean): boolean => tourWanted && !choiceOpen;

export function choose(choice: Choice): void {
  accountChoice.set(choice);
}

function subscribe(listener: () => void): () => void {
  const stopChoice = accountChoice.subscribe(listener);
  const stopSummary = accountSummary.subscribe(listener);
  return () => {
    stopChoice();
    stopSummary();
  };
}

/** Whether to offer the choice now, from what this device holds. */
export function choiceNeeded(pathname: string): boolean {
  return offersChoice({
    enabled: accountsEnabled(),
    signedIn: accountSummary.read() !== null || hasStoredSession(),
    chosen: accountChoice.read() !== null,
    pathname,
  });
}

/** Never on the server or the first render: a signed-in learner never sees it flash. */
export function useChoiceOpen(pathname: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => choiceNeeded(pathname),
    () => false,
  );
}
