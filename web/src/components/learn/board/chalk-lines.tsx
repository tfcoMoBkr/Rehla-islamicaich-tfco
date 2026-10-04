"use client";

import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

type ChalkLinesProps = {
  lines: readonly string[];
  /** Lines before this index are written; the line at it is being written. */
  cursor: number;
  wordMs: number;
  /** The line the voice is reading, underlined in dawn gold. */
  reading: number | null;
  /** Shown beside each line once it is written, e.g. "I didn't understand". */
  after?: (line: string, index: number) => ReactNode;
};

/**
 * Text written on the board in chalk, a word at a time. Lines not yet written keep their place
 * (and are already there for screen readers), so the board never jumps as it fills.
 */
export function ChalkLines({ lines, cursor, wordMs, reading, after }: ChalkLinesProps) {
  return (
    <div className="chalk-text grid gap-3 text-xl leading-relaxed sm:text-2xl sm:leading-relaxed">
      {lines.map((line, index) => {
        const state = index < cursor ? "written" : index === cursor ? "writing" : "pending";
        let word = 0;
        return (
          <p
            key={`${index}-${line}`}
            data-state={state}
            style={{ "--word-ms": `${wordMs}ms` } as CSSProperties}
            className="chalk-line flex items-start gap-1"
          >
            <span
              className={cn(
                "min-w-0 flex-1 decoration-dawn decoration-2 underline-offset-[0.4em]",
                reading === index && "underline",
              )}
            >
              {line.split(/(\s+)/).map((part, position) =>
                /^\s+$/.test(part) || part === "" ? (
                  part
                ) : (
                  <span key={position} className="chalk-word" style={{ "--word": word++ } as CSSProperties}>
                    {part}
                  </span>
                ),
              )}
            </span>
            {state === "written" && after?.(line, index)}
          </p>
        );
      })}
    </div>
  );
}
