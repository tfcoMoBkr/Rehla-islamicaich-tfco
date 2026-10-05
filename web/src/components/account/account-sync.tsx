"use client";

import { useEffect } from "react";

import { accountsEnabled } from "@/config/accounts";
import { hasStoredSession } from "@/lib/account/session";

/**
 * Picks up a stored session when a page opens, and keeps syncing progress from there. For a guest
 * it does nothing and loads nothing.
 */
export function AccountSync() {
  useEffect(() => {
    if (!accountsEnabled() || !hasStoredSession()) return;
    void import("@/lib/account/actions").then(({ resumeAccount }) => resumeAccount()).catch(() => undefined);
  }, []);
  return null;
}
