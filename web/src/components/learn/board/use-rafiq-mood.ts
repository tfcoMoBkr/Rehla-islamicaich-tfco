"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import type { RafiqMood } from "./rafiq-context";

/** How long a reaction lasts before Rafiq settles back; thinking waits longer for the learner. */
const REACTION_MS = 2600;
const THINKING_MS = 8000;

type Reaction = { mood: RafiqMood; board: string };

/**
 * Rafiq's mood on the board shown: his reaction to the learner's last action on this board, or
 * his resting mood (writing while the board fills, idle otherwise). Each reaction picks the next
 * of his short captions, which come from the message files and never state a religious fact.
 */
export function useRafiqMood(board: string, resting: RafiqMood, place: "intro" | "close" | "board") {
  const t = useTranslations("RafiqCaptions");
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [count, setCount] = useState(0);
  const currentBoard = useRef(board);

  useEffect(() => {
    currentBoard.current = board;
  });

  const react = useCallback((mood: RafiqMood) => {
    setReaction({ mood, board: currentBoard.current });
    setCount((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!reaction) return;
    const timer = window.setTimeout(() => setReaction(null), reaction.mood === "thinking" ? THINKING_MS : REACTION_MS);
    return () => window.clearTimeout(timer);
  }, [reaction]);

  const mood = reaction && reaction.board === board ? reaction.mood : resting;
  const key = mood === "idle" && place !== "board" ? place : mood;
  const raw: unknown = t.raw(key);
  const captions = Array.isArray(raw) ? raw.filter((caption): caption is string => typeof caption === "string") : [];
  const caption = captions[(count + board.length) % Math.max(captions.length, 1)] ?? "";

  return { mood, caption, react };
}
