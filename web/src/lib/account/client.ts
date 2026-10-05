import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseConfig } from "@/config/accounts";

import { AUTH_STORAGE_KEY } from "./session";

let pending: Promise<SupabaseClient> | null = null;

/**
 * The browser's Supabase client, holding the session in this browser. It is loaded on first use,
 * so a guest never downloads it.
 */
export function accountClient(): Promise<SupabaseClient> {
  pending ??= import("@supabase/supabase-js")
    .then(({ createClient }) => {
      const config = supabaseConfig();
      if (!config) throw new Error("Accounts are not configured");
      return createClient(config.url, config.key, {
        auth: { storageKey: AUTH_STORAGE_KEY, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
    })
    .catch((error: unknown) => {
      // A failed download (offline) can be tried again.
      pending = null;
      throw error;
    });
  return pending;
}
