import type { CSSProperties, ReactNode } from "react";

/**
 * The open-air class: a sky that moves from night toward dawn as the lesson goes on, with the
 * board standing on the ground. `progress` runs from 0 (the lesson's start) to 1 (its close).
 */
export function LessonStage({ progress, children }: { progress: number; children: ReactNode }) {
  return (
    <div
      className="lesson-stage relative isolate overflow-hidden"
      style={{ "--dawn-progress": Math.min(Math.max(progress, 0), 1) } as CSSProperties}
    >
      <div aria-hidden className="stage-stars pointer-events-none absolute inset-x-0 top-0 -z-10 h-96" />
      <div
        aria-hidden
        className="stage-sun pointer-events-none absolute inset-x-0 bottom-0 -z-10 mx-auto size-[22rem] rounded-full bg-dawn/45"
      />
      <div className="mx-auto max-w-2xl px-3 pt-5 sm:px-6 sm:pt-8">{children}</div>
      <div aria-hidden className="h-14 bg-[color-mix(in_oklab,var(--ink)_80%,var(--oasis))]" />
    </div>
  );
}
