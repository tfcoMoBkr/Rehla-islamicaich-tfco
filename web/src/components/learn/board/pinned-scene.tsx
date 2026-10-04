"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef } from "react";

import type { LessonVisualView } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

export type SceneState = {
  /** 0 to 1: how far the learner is in the part of the lesson on the board. */
  progress: number;
  /** The step in focus, if the activity has one (the day arc's stop). */
  focus: number | null;
};

type PinnedSceneProps = {
  visual: LessonVisualView;
  state: SceneState;
  className?: string;
};

const PART = "data-scene-part";

/**
 * The lesson's drawing, pinned to the board like a sheet of paper. Its parts light up in order
 * as the learner advances, fade where the lesson clears them, and one part may travel to the step
 * in focus. The drawing is decorative: the board's text carries the lesson.
 */
export function PinnedScene({ visual, state, className }: PinnedSceneProps) {
  const t = useTranslations("Board");
  const root = useRef<HTMLDivElement>(null);
  const progress = Math.min(Math.max(state.progress, 0), 1);
  const scene = visual.scenes[Math.min(Math.floor(progress * visual.scenes.length), visual.scenes.length - 1)];
  const markup = useMemo(() => ({ __html: scene?.markup ?? "" }), [scene]);
  const lit = Math.round(progress * visual.reveal.length);
  const cleared = Math.round(progress * visual.clear.length);
  const focus = state.focus ?? Math.max(lit - 1, 0);

  useEffect(() => {
    const container = root.current;
    if (!container || !scene) return;
    const part = (id: string) => container.querySelector<SVGGraphicsElement>(`[id="${scene.prefix}${id}"]`);

    visual.reveal.forEach((id, index) => {
      part(id)?.setAttribute(PART, index < lit ? (index === lit - 1 ? "new" : "lit") : "dim");
    });
    visual.clear.forEach((id, index) => {
      part(id)?.setAttribute(PART, index < cleared ? "cleared" : "lit");
    });

    if (visual.follow) {
      const mover = part(visual.follow.part);
      const target = part(visual.follow.along[Math.min(focus, visual.follow.along.length - 1)] ?? "");
      if (mover && target) {
        const from = mover.getBBox();
        const to = target.getBBox();
        const dx = to.x + to.width / 2 - (from.x + from.width / 2);
        const dy = to.y + to.height / 2 - (from.y + from.height / 2);
        mover.setAttribute("data-scene-follow", "");
        mover.style.transform = `translate(${dx}px, ${dy}px)`;
      }
    }
  }, [scene, visual, lit, cleared, focus]);

  if (!scene) return null;

  return (
    <figure className={cn("relative", className)}>
      <span aria-hidden className="absolute -top-1.5 left-1/2 z-10 size-3.5 -translate-x-1/2 rounded-full border-2 border-night bg-dawn" />
      <div
        ref={root}
        dangerouslySetInnerHTML={markup}
        className="pinned-scene -rotate-2 overflow-hidden rounded-md border-4 border-paper bg-paper shadow-[0_10px_18px_-10px_color-mix(in_srgb,var(--night)_90%,transparent)]"
      />
      {visual.needsReview && (
        <figcaption className="mt-2 text-center text-xs font-semibold text-dawn">{t("drawingAwaitingReview")}</figcaption>
      )}
    </figure>
  );
}
