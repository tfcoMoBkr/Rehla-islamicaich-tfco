import "server-only";

import type { LessonVisualView } from "@/lib/learn/types";

import { loadVisuals, readArtSvg } from "./load";
import { prefixSvgIds, svgIds } from "./scene-svg";
import { showDrafts } from "./visibility";

/**
 * The drawing pinned on a lesson's board, from content/visuals.json. A drawing still awaiting
 * review is shown only where drafts are. Every part the file names must exist in its scenes.
 */
export async function toVisualView(lessonId: string): Promise<LessonVisualView | null> {
  const entry = (await loadVisuals()).find((candidate) => candidate.lesson === lessonId);
  if (!entry || (entry.needsReview && !showDrafts())) return null;

  const scenes = await Promise.all(
    entry.scenes.map(async (name) => {
      const svg = await readArtSvg(`scenes/${name}.svg`);
      if (!svg) throw new Error(`content/visuals.json: lesson ${lessonId} uses scene "${name}", which is not in content/art/manifest.json`);
      const prefix = `scene-${name}-`;
      return { name, prefix, ids: new Set(svgIds(svg)), markup: prefixSvgIds(svg, prefix) };
    }),
  );

  const named = [...entry.reveal, ...entry.clear, ...(entry.follow ? [entry.follow.part, ...entry.follow.along] : [])];
  const missing = named.filter((part) => !scenes.some((scene) => scene.ids.has(part)));
  if (missing.length > 0) {
    throw new Error(`content/visuals.json: lesson ${lessonId} names parts its scenes do not have: ${missing.join(", ")}`);
  }

  return {
    scenes: scenes.map(({ name, prefix, markup }) => ({ name, prefix, markup })),
    reveal: entry.reveal,
    clear: entry.clear,
    follow: entry.follow ?? null,
    ambience: entry.ambience ?? null,
    needsReview: entry.needsReview,
  };
}
