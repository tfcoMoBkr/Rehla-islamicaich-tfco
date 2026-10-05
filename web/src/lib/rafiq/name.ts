import { accountSummary, useAccount } from "@/lib/account/session";

import { learnerName, nameAsked, nameUnused } from "./memory";

/*
 * The name Rafiq calls the learner by. It is the display name of their account when they are signed
 * in, and otherwise the name they gave on this device. It never leaves the device for the AI
 * service: Rafiq writes the placeholder {{name}} in his warm lines, and the page fills it in here.
 * The same removal rules run in the service (ai/app/rafiq/name.py).
 */

const PLACEHOLDER = /\{\{\s*name\s*\}\}/gi;
const NAME = String.raw`\{\{\s*name\s*\}\}`;
// The placeholder with what only makes sense beside a name: an Arabic vocative «يا», and the comma
// that sets the name apart. Longest forms first.
const WITH_PUNCTUATION = [
  new RegExp(String.raw`[،,]\s*(?:يا\s*)?${NAME}\s*[،,]`, "gi"),
  new RegExp(String.raw`[،,]\s*يا\s*${NAME}`, "gi"),
  new RegExp(String.raw`يا\s*${NAME}\s*[،,]?`, "gi"),
  new RegExp(String.raw`[،,]\s*${NAME}`, "gi"),
  new RegExp(String.raw`${NAME}\s*[،,]?`, "gi"),
];

/** The text with the placeholder, and the vocative or comma around it, removed cleanly. */
export function withoutName(text: string): string {
  if (!/\{\{\s*name\s*\}\}/i.test(text)) return text;
  let result = text;
  for (const pattern of WITH_PUNCTUATION) result = result.replace(pattern, "");
  result = result
    .replace(/\s+([.!?؟،,۔।])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^[،,.\s]+/, "");
  // A sentence that began with the name now begins with the next word.
  return result.replace(/(^|[.!?]\s+)([a-z])/g, (_match, before: string, letter: string) => before + letter.toUpperCase());
}

// First-strong isolates keep a name in one script whole inside a line in another.
const ISOLATE_START = "⁨";
const ISOLATE_END = "⁩";

/** A warm line with the learner's name in place of the placeholder, exactly as they typed it, or without it. */
export function fillName(text: string, name: string | null): string {
  if (!name) return withoutName(text);
  return text.replace(PLACEHOLDER, `${ISOLATE_START}${name}${ISOLATE_END}`);
}

/** The name to use: the account's (unless the learner asked Rafiq not to), else the one on this device. */
export function useLearnerName(): string | null {
  const account = useAccount();
  const device = learnerName.use();
  const unused = nameUnused.use();
  if (account) return unused ? null : account.name;
  return device;
}

/** Whether Rafiq should ask for a name: a guest who has not answered yet. */
export function useAsksForName(): boolean {
  const account = useAccount();
  const asked = nameAsked.use();
  const device = learnerName.use();
  return !account && !asked && !device;
}

/** Keeps the name where it belongs: the account's profile when signed in, otherwise this device. */
export async function saveLearnerName(name: string, locale: "ar" | "en"): Promise<boolean> {
  const account = accountSummary.read();
  if (!account) {
    learnerName.set(name);
    nameAsked.set("yes");
    return true;
  }
  const { updateProfile } = await import("@/lib/account/actions");
  const result = await updateProfile(name, account.country, locale);
  if (result.ok) nameUnused.set(null);
  return result.ok;
}

/** A guest's name is forgotten; a signed-in learner's stays in their account, and Rafiq stops using it. */
export function removeLearnerName(): void {
  if (accountSummary.read()) nameUnused.set("yes");
  else learnerName.set(null);
  nameAsked.set("yes");
}
