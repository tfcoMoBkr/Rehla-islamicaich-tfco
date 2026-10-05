import "server-only";

import { createClient } from "@supabase/supabase-js";

import { supabaseConfig } from "@/config/accounts";

/*
 * The only place the server-only secret key is read. It deletes an account, and only after the
 * learner's own session token has been checked; the tables follow by cascade.
 */

export type Deletion = "deleted" | "unauthorized" | "unavailable";

export async function deleteAccountFor(token: string): Promise<Deletion> {
  const config = supabaseConfig();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!config || !secret) return "unavailable";

  const admin = createClient(config.url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return "unauthorized";

  const deleted = await admin.auth.admin.deleteUser(data.user.id);
  return deleted.error ? "unavailable" : "deleted";
}
