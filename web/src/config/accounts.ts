/*
 * Accounts are optional, and exist only when the Supabase project is configured. Without these
 * variables every account entry point is hidden and Rehla works for guests exactly as before.
 * Both values are public by design: the publishable key only reaches what row level security allows.
 */

export type SupabaseConfig = { url: string; key: string };

export function supabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

export const accountsEnabled = (): boolean => supabaseConfig() !== null;
