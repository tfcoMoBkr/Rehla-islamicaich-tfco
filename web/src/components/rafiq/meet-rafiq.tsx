"use client";

import { BookMarked, MessageCircle, UserRoundCheck, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { RafiqPose } from "@/lib/content/schema";
import { cn } from "@/lib/utils";

import { RafiqStage } from "./rafiq-stage";

const LINES = ["lantern", "light", "limits", "ask"] as const;
/** His pose follows the line he is saying. */
const POSE: Record<(typeof LINES)[number], RafiqPose> = {
  lantern: "hello",
  light: "pointing",
  limits: "listening",
  ask: "happy",
};
const CHIPS: readonly { key: "simple" | "source" | "specialist"; icon: LucideIcon }[] = [
  { key: "simple", icon: MessageCircle },
  { key: "source", icon: BookMarked },
  { key: "specialist", icon: UserRoundCheck },
];
const LINE_MS = 1700;

type MeetRafiqProps = {
  /** The id its heading gets, for aria-labelledby. */
  id: string;
  /** "section": the home page's stop; "intro": the top of the Rafiq page and the dialog. */
  layout?: "section" | "intro";
  /** What follows the introduction: a link to his page, or a button that starts the conversation. */
  action?: ReactNode;
  headingLevel?: 2 | 3;
};

/**
 * Rafiq introduces himself in four lines that light up one after another as they come into view,
 * his pose following each line. Every line is in the page from the start, so nothing is hidden
 * from a screen reader or without motion; the lines only brighten in turn.
 */
export function MeetRafiq({ id, layout = "section", action, headingLevel = 2 }: MeetRafiqProps) {
  const t = useTranslations("MeetRafiq");
  const reduced = usePrefersReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  // Every line is lit on the server and under reduced motion; the sequence starts once it is seen.
  const [lit, setLit] = useState<number>(LINES.length);
  const [started, setStarted] = useState(false);
  const playing = started && lit < LINES.length;

  useEffect(() => {
    const element = root.current;
    if (reduced || !element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        setLit(1);
        setStarted(true);
      },
      { threshold: 0.35 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [reduced]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setLit((current) => current + 1), LINE_MS);
    return () => window.clearTimeout(timer);
  }, [playing, lit]);

  const speaking = LINES[Math.min(lit, LINES.length) - 1] ?? "lantern";
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const intro = layout === "intro";

  return (
    <div
      ref={root}
      className={cn(
        "grid items-start gap-6",
        intro ? "sm:grid-cols-[auto_minmax(0,1fr)]" : "md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-center md:gap-12",
      )}
    >
      <div className={cn("grid justify-items-center", intro ? "justify-self-center" : "md:justify-self-end")}>
        <RafiqStage pose={POSE[speaking]} thinking={playing} height={intro ? 128 : 220} decorative />
      </div>
      <div className="grid gap-5">
        <Heading id={id} className={cn("font-display font-semibold", intro ? "text-2xl" : "text-3xl sm:text-4xl")}>
          {t("title")}
        </Heading>
        <div className="relative rounded-3xl rounded-ss-md border border-hairline bg-paper p-5 text-ink shadow-sm sm:p-6">
          <ol className="grid gap-3 text-lg leading-relaxed">
            {LINES.map((line, index) => (
              <li
                key={line}
                className={cn(
                  "transition-[opacity,transform] duration-500 motion-reduce:transition-none",
                  index < lit ? "opacity-100" : "translate-y-1 opacity-35",
                )}
              >
                {t(`lines.${line}`)}
              </li>
            ))}
          </ol>
        </div>
        <ul className="flex flex-wrap gap-2">
          {CHIPS.map(({ key, icon: Icon }) => (
            <li
              key={key}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-hairline bg-paper px-4 text-sm font-semibold text-ink"
            >
              <Icon aria-hidden className="size-4 text-oasis-text" />
              {t(`chips.${key}`)}
            </li>
          ))}
        </ul>
        {action}
      </div>
    </div>
  );
}
