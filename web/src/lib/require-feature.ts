import { notFound } from "next/navigation";

import { accountsEnabled } from "@/config/accounts";
import { features, type Feature } from "@/config/features";

export function requireFeature(feature: Feature): void {
  if (!features[feature]) {
    notFound();
  }
}

/** Account screens exist only when the Supabase project is configured. */
export function requireAccounts(): void {
  if (!accountsEnabled()) {
    notFound();
  }
}
