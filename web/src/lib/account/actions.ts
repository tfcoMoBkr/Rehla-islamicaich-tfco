import type { SupabaseClient } from "@supabase/supabase-js";
import * as z from "zod/mini";

import { tourSeen } from "@/lib/guide-store";
import { progressActions } from "@/lib/learn/progress-store";
import { forgetEverything } from "@/lib/rafiq/memory";

import { accountClient } from "./client";
import { isListedCountry } from "./countries";
import { accountError, type AccountError } from "./errors";
import { accountSummary, type AccountSummary } from "./session";
import { flush, readProgressRows, startSync, stopSync } from "./sync";

/*
 * What the account screens do. Sign-up sends exactly three things besides the email and password:
 * the display name, the country if one was chosen, and the page language. Nothing here reaches
 * the AI service.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const DELETE_PATH = "/api/account/delete";

type Locale = "ar" | "en";
export type Failure = { ok: false; error: AccountError };
type Result<T = object> = ({ ok: true } & T) | Failure;

const fail = (error: unknown): Failure => ({ ok: false, error: accountError(error) });

const unlisted = (country: string | null): boolean => country !== null && !isListedCountry(country);

const profileSchema = z.object({
  display_name: z.string(),
  country: z.nullable(z.string()),
  locale: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Profile = z.infer<typeof profileSchema>;

async function loadProfile(client: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await client.from("profiles").select("display_name, country, locale, created_at, updated_at").eq("id", userId).maybeSingle();
  if (error) throw error;
  const parsed = profileSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

const summaryOf = (profile: Pick<Profile, "display_name" | "country">): AccountSummary => ({
  name: profile.display_name,
  country: profile.country,
});

/** After any sign-in: show the name, and join this device's progress with the account's. */
async function begin(client: SupabaseClient, userId: string, known?: AccountSummary): Promise<void> {
  if (known) accountSummary.set(known);
  try {
    const profile = await loadProfile(client, userId);
    if (profile) accountSummary.set(summaryOf(profile));
  } catch {
    // Offline: the name shown is the one already known, and the next page load reads it again.
  }
  await startSync(client, userId);
}

let watching = false;

function watchSession(client: SupabaseClient): void {
  if (watching) return;
  watching = true;
  client.auth.onAuthStateChange((event) => {
    // The session ended elsewhere (another tab, or it expired): stop sending, keep the device as it is.
    if (event === "SIGNED_OUT") {
      stopSync();
      accountSummary.set(null);
    }
  });
}

/** On a page load with a stored session: refresh the name and carry on syncing. */
export async function resumeAccount(): Promise<void> {
  const client = await accountClient();
  watchSession(client);
  const { data } = await client.auth.getSession();
  if (!data.session) {
    accountSummary.set(null);
    return;
  }
  await begin(client, data.session.user.id);
}

export async function signUp(input: {
  email: string;
  password: string;
  displayName: string;
  country: string | null;
  locale: Locale;
}): Promise<Result<{ signedIn: boolean }>> {
  if (unlisted(input.country)) return { ok: false, error: "countryNotListed" };
  try {
    const client = await accountClient();
    watchSession(client);
    const { data, error } = await client.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { display_name: input.displayName, country: input.country, locale: input.locale },
        emailRedirectTo: `${window.location.origin}/${input.locale}/account`,
      },
    });
    if (error) return fail(error);
    // With email confirmation on, there is no session until the learner follows the link.
    if (!data.session || !data.user) return { ok: true, signedIn: false };
    await begin(client, data.user.id, { name: input.displayName, country: input.country });
    return { ok: true, signedIn: true };
  } catch (error) {
    return fail(error);
  }
}

export async function signIn(email: string, password: string): Promise<Result> {
  try {
    const client = await accountClient();
    watchSession(client);
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return fail(error);
    await begin(client, data.user.id);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Everything personal on this device. Language (in the address) and board sounds stay. */
export function clearDevice(): void {
  progressActions.forget();
  forgetEverything();
  tourSeen.forget();
  accountSummary.set(null);
}

/**
 * Signs out on this device: sends what is still waiting, then removes the account's data from
 * the device. Without `force`, it stops and says so when something could not be sent.
 */
export async function signOut({ force = false } = {}): Promise<Result | { ok: false; error: "unsaved" }> {
  if (!(await flush()) && !force) return { ok: false, error: "unsaved" };
  stopSync();
  try {
    const client = await accountClient();
    await client.auth.signOut({ scope: "local" });
  } catch {
    // The session is removed from this browser even when the server cannot be told.
  }
  clearDevice();
  return { ok: true };
}

async function currentUser(client: SupabaseClient) {
  const { data } = await client.auth.getSession();
  return data.session?.user ?? null;
}

export async function readAccount(): Promise<Result<{ email: string; profile: Profile }> | { ok: false; error: "signedOut" }> {
  try {
    const client = await accountClient();
    const user = await currentUser(client);
    if (!user) return { ok: false, error: "signedOut" };
    const profile = await loadProfile(client, user.id);
    if (!profile) return { ok: false, error: "unknown" };
    accountSummary.set(summaryOf(profile));
    return { ok: true, email: user.email ?? "", profile };
  } catch (error) {
    return fail(error);
  }
}

export async function updateProfile(displayName: string, country: string | null, locale: Locale): Promise<Result> {
  if (unlisted(country)) return { ok: false, error: "countryNotListed" };
  try {
    const client = await accountClient();
    const user = await currentUser(client);
    if (!user) return { ok: false, error: "sessionEnded" };
    const { error } = await client.from("profiles").update({ display_name: displayName, country, locale }).eq("id", user.id);
    if (error) return fail(error);
    accountSummary.set({ name: displayName, country });
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Asks for the current password first, so an unattended device cannot be taken over. */
export async function changePassword(current: string, next: string): Promise<Result> {
  try {
    const client = await accountClient();
    const user = await currentUser(client);
    if (!user?.email) return { ok: false, error: "sessionEnded" };
    const check = await client.auth.signInWithPassword({ email: user.email, password: current });
    if (check.error) {
      const error = accountError(check.error);
      return { ok: false, error: error === "wrongPassword" ? "currentPasswordWrong" : error };
    }
    const { error } = await client.auth.updateUser({ password: next });
    return error ? fail(error) : { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/** Everything the account holds about the learner, as one JSON document. */
export async function exportData(): Promise<Result<{ data: object }>> {
  try {
    const client = await accountClient();
    const user = await currentUser(client);
    if (!user) return { ok: false, error: "sessionEnded" };
    const [profile, progress, community] = await Promise.all([
      loadProfile(client, user.id),
      readProgressRows(client, user.id),
      readCommunityRows(client, user.id),
    ]);
    return {
      ok: true,
      data: {
        exportedAt: new Date().toISOString(),
        account: { email: user.email ?? null, createdAt: user.created_at },
        profile,
        progress,
        community,
      },
    };
  } catch (error) {
    return fail(error);
  }
}

/** The member's community name and settings, and what they wrote (null when they never joined). */
async function readCommunityRows(client: SupabaseClient, userId: string): Promise<object | null> {
  const read = async (table: string, columns: string, column: string) => {
    const { data, error } = await client.from(table).select(columns).eq(column, userId);
    // A project that has not run the community migration has nothing to export from it.
    if (error?.code === "PGRST205" || error?.code === "42P01") return [];
    if (error) throw error;
    return data;
  };
  const [member, posts, replies] = await Promise.all([
    read("community_members", "name, show_country, role, joined_at", "user_id"),
    read("community_posts", "id, category, title, body, language, created_at, edited_at, hidden", "author"),
    read("community_replies", "id, post, body, created_at, hidden", "author"),
  ]);
  return member.length === 0 && posts.length === 0 ? null : { member: member[0] ?? null, posts, replies };
}

/** Deletes the account and everything in it (the server checks the session first), then empties this device. */
export async function deleteAccount(): Promise<Result> {
  try {
    const client = await accountClient();
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: "sessionEnded" };
    const response = await fetch(DELETE_PATH, { method: "POST", headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) return { ok: false, error: response.status === 401 ? "sessionEnded" : "unknown" };
    stopSync();
    await client.auth.signOut({ scope: "local" }).catch(() => undefined);
    clearDevice();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
