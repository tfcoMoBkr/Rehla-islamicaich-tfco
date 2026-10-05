"use client";

import { useCallback, useEffect, useState } from "react";

import { hasStoredSession } from "@/lib/account/session";

import { myMembership } from "./data";
import type { Membership } from "./types";

export type Standing =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "signedIn" }
  | { kind: "member"; membership: Membership }
  | { kind: "failed" };

/** Who is reading: a guest (who never downloads the sign-in library), a signed-in reader, or a member. */
export function useStanding(): { standing: Standing; refresh: () => void } {
  const [standing, setStanding] = useState<Standing>({ kind: "loading" });
  const [round, setRound] = useState(0);

  useEffect(() => {
    let current = true;
    const read = hasStoredSession() ? myMembership() : Promise.resolve({ ok: true, value: undefined } as const);
    void read.then((result) => {
      if (!current) return;
      if (!result.ok) setStanding({ kind: "failed" });
      else if (result.value === undefined) setStanding({ kind: "guest" });
      else setStanding(result.value ? { kind: "member", membership: result.value } : { kind: "signedIn" });
    });
    return () => {
      current = false;
    };
  }, [round]);

  const refresh = useCallback(() => setRound((value) => value + 1), []);
  return { standing, refresh };
}

export const isModerator = (standing: Standing): boolean => standing.kind === "member" && standing.membership.role === "moderator";
