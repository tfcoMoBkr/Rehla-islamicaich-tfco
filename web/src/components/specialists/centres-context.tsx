"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { ReferralCentres } from "@/lib/content/schema";

const CentresContext = createContext<ReferralCentres | null>(null);

/** The referral bodies of content/referral-centers.json, read once by the locale layout. */
export function ReferralCentresProvider({ value, children }: { value: ReferralCentres; children: ReactNode }) {
  return <CentresContext.Provider value={value}>{children}</CentresContext.Provider>;
}

export function useReferralCentres(): ReferralCentres {
  const centres = useContext(CentresContext);
  if (!centres) throw new Error("Referral bodies are read by the locale layout; render inside it");
  return centres;
}
