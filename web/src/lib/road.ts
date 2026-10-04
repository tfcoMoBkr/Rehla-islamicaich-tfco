/** Marks an element the road must pass through (see RoadJourney). */
export const ROAD_ANCHOR_ATTRIBUTE = "data-road-anchor";

export type Point = { x: number; y: number };

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Builds a winding SVG path through `points`, top to bottom.
 *
 * Neighbouring points at different x positions are joined by an S-curve with vertical
 * tangents, so the road enters and leaves every station straight. Points stacked in one
 * column would give a ruler-straight line, so those segments bow out by `meander`,
 * alternating sides, to keep the road hand-drawn.
 */
export function buildRoadPath(points: readonly Point[], meander: number): string {
  const [first, ...rest] = points;
  if (!first || rest.length === 0) {
    return "";
  }

  let previous = first;
  let path = `M${round(first.x)} ${round(first.y)}`;

  rest.forEach((point, index) => {
    const reach = (point.y - previous.y) * 0.45;
    const isStacked = Math.abs(point.x - previous.x) < meander;
    const bow = isStacked ? (index % 2 === 0 ? meander : -meander) : 0;

    path += ` C${round(previous.x + bow)} ${round(previous.y + reach)} ${round(point.x + bow)} ${round(point.y - reach)} ${round(point.x)} ${round(point.y)}`;
    previous = point;
  });

  return path;
}

type LengthSample = { length: number; y: number };

export function sampleByHeight(path: SVGPathElement, count: number): LengthSample[] {
  const total = path.getTotalLength();
  return Array.from({ length: count + 1 }, (_, index) => {
    const length = (total * index) / count;
    return { length, y: path.getPointAtLength(length).y };
  });
}

/** Length along the road at which it first reaches height `y` (the road only descends). */
export function lengthAtHeight(samples: readonly LengthSample[], y: number): number {
  const last = samples.at(-1);
  if (!last || y >= last.y) {
    return last?.length ?? 0;
  }
  const index = samples.findIndex((sample) => sample.y >= y);
  if (index <= 0) {
    return 0;
  }
  const before = samples[index - 1];
  const after = samples[index];
  const span = after.y - before.y || 1;
  return before.length + ((y - before.y) / span) * (after.length - before.length);
}
