import { Lantern } from "@/components/journey/lantern";
import type { CoverMotif } from "@/lib/content/schema";
import { cn } from "@/lib/utils";

/*
 * A lesson's opening scene, in the road-at-dawn style, composed from the motifs its lesson (or
 * station) names. Flat, hand-cut shapes; no figures and no religious symbols. The sky fades in,
 * then the sun's arc and the path draw themselves; with reduced motion everything is simply there.
 */

const WIDTH = 360;
const HORIZON = 126;

const SKY_BANDS = [
  { rx: 320, ry: 112, fill: "var(--ink)" },
  { rx: 240, ry: 72, fill: "color-mix(in srgb, var(--ink) 70%, var(--terracotta))" },
  { rx: 160, ry: 42, fill: "color-mix(in srgb, var(--terracotta) 60%, var(--dawn))" },
  { rx: 86, ry: 20, fill: "color-mix(in srgb, var(--dawn) 75%, var(--sand))" },
];

const STARS = [
  [26, 22, 1.1], [58, 44, 0.8], [92, 16, 1.3], [128, 36, 0.7], [162, 12, 1], [204, 30, 0.9], [236, 14, 1.2],
  [268, 40, 0.8], [300, 20, 1.1], [334, 34, 0.9], [44, 70, 0.7], [316, 64, 0.8], [110, 60, 0.6], [252, 58, 0.6],
] as const;

const PATH = `M168 168C168 156 132 150 150 141S206 133 186 ${HORIZON}`;

function Motif({ motif }: { motif: CoverMotif }) {
  switch (motif) {
    case "dawnSky":
      return (
        <g className="animate-cover-fade">
          {SKY_BANDS.map((band) => (
            <ellipse key={band.rx} cx={WIDTH / 2} cy={HORIZON + 2} rx={band.rx} ry={band.ry} style={{ fill: band.fill }} />
          ))}
          <circle cx={WIDTH / 2} cy={HORIZON + 4} r="15" fill="var(--dawn)" />
        </g>
      );
    case "sunArc":
      return (
        <g>
          <path
            d={`M38 ${HORIZON}A142 90 0 0 1 322 ${HORIZON}`}
            fill="none"
            stroke="var(--dawn)"
            strokeWidth="1.5"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1 1"
            className="animate-cover-draw"
            opacity="0.85"
          />
          <g className="animate-cover-fade [animation-delay:1.2s]">
            <circle cx="114" cy="48" r="13" fill="var(--dawn)" opacity="0.25" />
            <circle cx="114" cy="48" r="7.5" fill="var(--dawn)" />
          </g>
        </g>
      );
    case "stars":
      return (
        <g fill="var(--sand)">
          {STARS.map(([x, y, r], index) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r={r}
              opacity={0.75 - (y / HORIZON) * 0.4}
              className="animate-cover-fade"
              style={{ animationDelay: `${0.2 + index * 0.06}s` }}
            />
          ))}
        </g>
      );
    case "water":
      return (
        <g className="animate-cover-fade [animation-delay:0.6s]">
          <ellipse cx="262" cy="150" rx="66" ry="10" style={{ fill: "color-mix(in srgb, var(--dawn) 28%, var(--ink))" }} />
          <g fill="none" stroke="var(--sand)" strokeOpacity="0.55" strokeWidth="1.2" strokeLinecap="round">
            <path d="M218 148q8-3 16 0t16 0 16 0" />
            <path d="M238 154q8-3 16 0t16 0 16 0" />
            <path d="M262 144q6-2 12 0t12 0" />
          </g>
        </g>
      );
    case "path":
      return (
        <g fill="none" strokeLinecap="round">
          <path
            d={PATH}
            stroke="color-mix(in srgb, var(--sand) 22%, var(--night))"
            strokeWidth="11"
            pathLength={1}
            strokeDasharray="1 1"
            className="animate-cover-draw"
          />
          <path d={PATH} stroke="var(--dawn)" strokeWidth="1.4" strokeDasharray="4 5" className="animate-cover-fade [animation-delay:1.4s]" />
        </g>
      );
    case "lantern":
      return (
        <g className="animate-cover-fade [animation-delay:0.9s]">
          <ellipse cx="114" cy="161" rx="26" ry="4" fill="var(--dawn)" opacity="0.2" />
          <Lantern x="98" y="128" width="32" height="36" className="lantern-flare text-sand" />
        </g>
      );
  }
}

const BACK_TO_FRONT: readonly CoverMotif[] = ["dawnSky", "sunArc", "stars"];

export function LessonCover({ motifs, className }: { motifs: readonly CoverMotif[]; className?: string }) {
  const sky = BACK_TO_FRONT.filter((motif) => motifs.includes(motif));
  const ground = (["water", "path", "lantern"] as const).filter((motif) => motifs.includes(motif));

  return (
    <svg
      viewBox={`0 0 ${WIDTH} 168`}
      aria-hidden="true"
      className={cn("block w-full overflow-hidden rounded-2xl", className)}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width={WIDTH} height="168" fill="var(--night)" />
      {sky.map((motif) => (
        <Motif key={motif} motif={motif} />
      ))}
      <path d={`M0 ${HORIZON}C60 118 120 124 180 ${HORIZON + 2}S300 118 360 124V168H0z`} fill="var(--ink)" />
      <path
        d="M0 152C80 142 160 150 220 154S320 146 360 151V168H0z"
        style={{ fill: "color-mix(in srgb, var(--ink) 55%, var(--night))" }}
      />
      {ground.map((motif) => (
        <Motif key={motif} motif={motif} />
      ))}
    </svg>
  );
}
