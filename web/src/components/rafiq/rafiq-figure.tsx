"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { createContext, useContext, type ReactNode } from "react";

import type { RafiqPose } from "@/lib/content/schema";
import { cn } from "@/lib/utils";

export type RafiqPoseImage = { src: string; width: number; height: number };
export type RafiqPoses = Record<RafiqPose, RafiqPoseImage>;

const RafiqPosesContext = createContext<RafiqPoses | null>(null);

/** Rafiq's poses from content/art/rafiq/manifest.json, read once by the layout. */
export function RafiqPosesProvider({ poses, children }: { poses: RafiqPoses; children: ReactNode }) {
  return <RafiqPosesContext.Provider value={poses}>{children}</RafiqPosesContext.Provider>;
}

export function useRafiqPoses(): RafiqPoses {
  const poses = useContext(RafiqPosesContext);
  if (!poses) throw new Error("Rafiq's poses are read by the locale layout; render inside it");
  return poses;
}

/** The rendered width of a pose shown `height` pixels tall. */
export function widthAt(image: RafiqPoseImage, height: number): number {
  return Math.round((image.width * height) / image.height);
}

type RafiqFigureProps = {
  pose: RafiqPose;
  /** Rendered height in CSS pixels; the image is requested at this size (and twice it for dense screens). */
  height: number;
  /** Shown by a speech bubble or label that already says what he does: then the image is decorative. */
  decorative?: boolean;
  priority?: boolean;
  className?: string;
};

/** Rafiq, the travelling lantern, in one of his poses. */
export function RafiqFigure({ pose, height, decorative = false, priority = false, className }: RafiqFigureProps) {
  const t = useTranslations("RafiqCharacter");
  const image = useRafiqPoses()[pose];

  return (
    <Image
      src={image.src}
      width={widthAt(image, height)}
      height={height}
      alt={decorative ? "" : t(`alt.${pose}`)}
      priority={priority}
      className={cn("select-none", className)}
      draggable={false}
    />
  );
}
