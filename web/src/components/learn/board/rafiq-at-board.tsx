"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

import { useRafiqPoses, widthAt } from "@/components/rafiq/rafiq-figure";
import type { RafiqPose } from "@/lib/content/schema";

import type { RafiqMood } from "./rafiq-context";

const HEIGHT = 132;

/** The poses Rafiq takes at the board. "writing" carries its own small board, so it is not used beside the big one. */
const BOARD_POSES = ["waving", "pointing", "happy", "thinking", "encouraging"] as const satisfies readonly RafiqPose[];

export function poseFor(mood: RafiqMood, atLessonStart: boolean): (typeof BOARD_POSES)[number] {
  switch (mood) {
    case "pleased":
      return "happy";
    case "thinking":
      return "thinking";
    case "encouraging":
      return "encouraging";
    case "writing":
      return "pointing";
    case "idle":
      return atLessonStart ? "waving" : "pointing";
  }
}

type RafiqAtBoardProps = {
  mood: RafiqMood;
  atLessonStart: boolean;
  caption: string;
};

/**
 * Rafiq at the board's top corner, with what he says in a speech bubble. Every board pose is
 * loaded up front and stacked, so a change of mood cross-fades to the new pose. He stands at the
 * start of the line and points along it, so in right-to-left pages he is mirrored.
 */
export function RafiqAtBoard({ mood, atLessonStart, caption }: RafiqAtBoardProps) {
  const t = useTranslations("Board");
  const tc = useTranslations("RafiqCharacter");
  const poses = useRafiqPoses();
  const shown = poseFor(mood, atLessonStart);
  const width = Math.max(...BOARD_POSES.map((pose) => widthAt(poses[pose], HEIGHT)));

  return (
    <div className="relative z-10 -mb-5 flex items-end gap-1">
      <div className="rafiq-figure relative shrink-0 rtl:-scale-x-100" style={{ width, height: HEIGHT }}>
        {BOARD_POSES.map((pose) => (
          <Image
            key={pose}
            src={poses[pose].src}
            width={widthAt(poses[pose], HEIGHT)}
            height={HEIGHT}
            alt={pose === shown ? tc(`alt.${pose}`) : ""}
            aria-hidden={pose === shown ? undefined : true}
            priority
            draggable={false}
            data-pose={pose}
            data-active={pose === shown || undefined}
            className="absolute inset-x-0 bottom-0 mx-auto opacity-0 transition-opacity duration-300 select-none data-active:opacity-100"
          />
        ))}
      </div>
      <p
        aria-live="polite"
        className="relative mb-12 max-w-[15rem] rounded-2xl rounded-es-sm bg-paper px-3.5 py-2 text-sm leading-snug font-medium text-ink shadow-[0_10px_18px_-12px_color-mix(in_srgb,var(--night)_90%,transparent)]"
      >
        <span className="sr-only">{t("rafiqSays")} </span>
        {caption}
      </p>
    </div>
  );
}
