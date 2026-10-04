"use client";

import { createContext, useContext } from "react";

/** Rafiq's states: idle, writing at the board, pleased, thinking, encouraging after a wrong try. */
export type RafiqMood = "idle" | "writing" | "pleased" | "thinking" | "encouraging";

const RafiqReactionContext = createContext<(mood: RafiqMood) => void>(() => {});

/** Lets activities and questions on a lesson board tell Rafiq what the learner just did. */
export const RafiqReactionProvider = RafiqReactionContext.Provider;

/** Off the lesson board (e.g. a station exam) nobody listens, and the call does nothing. */
export function useRafiqReaction(): (mood: RafiqMood) => void {
  return useContext(RafiqReactionContext);
}
