import * as z from "zod/mini";

import { deviceStore } from "@/lib/device-store";

/*
 * What the page needs to know about the account without loading the sign-in library: whether a
 * session is stored in this browser, and the display name and country to show. Both are cleared
 * on sign-out.
 */

/** Where supabase-js keeps the session in this browser (its `storageKey`). */
export const AUTH_STORAGE_KEY = "rehla.auth.v1";

export const DISPLAY_NAME_MAX_LENGTH = 40;

const summarySchema = z.object({
  name: z.string().check(z.minLength(1), z.maxLength(DISPLAY_NAME_MAX_LENGTH)),
  country: z.nullable(z.string().check(z.regex(/^[A-Z]{2}$/))),
});

export type AccountSummary = z.infer<typeof summarySchema>;

export const accountSummary = deviceStore<AccountSummary>("rehla.account.v1", (raw) => summarySchema.parse(JSON.parse(raw)), JSON.stringify);

/** The signed-in learner's display name and country, or null for a guest. */
export const useAccount = (): AccountSummary | null => accountSummary.use();

export function hasStoredSession(): boolean {
  try {
    return window.localStorage.getItem(AUTH_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
