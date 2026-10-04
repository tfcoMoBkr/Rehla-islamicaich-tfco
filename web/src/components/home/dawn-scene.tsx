import { Lantern } from "@/components/journey/lantern";
import { cn } from "@/lib/utils";

/*
 * The opening scene: night sky, the first light of dawn at the horizon, and a road that
 * winds from the traveller's lantern toward it. Drawn in flat bands like a hand-cut print.
 * The view box is 1440×1000 and is sliced from the bottom centre, so the road, the sun and
 * the lantern (all within x 470–970) stay in frame on a phone held upright.
 */

const ROAD_CENTRE = "M720 1000C720 940 560 900 600 840S820 760 790 720C770 695 720 685 722 666";
const ROAD_SURFACE =
  "M600 1000C625 940 490 900 552 840S792 760 774 720C761 695 714 685 720 666h4C726 685 779 695 806 720C848 760 672 780 648 840S815 940 840 1000z";

type Star = { x: number; y: number; r: number; opacity: number };

/** Deterministic scatter, so the sky is identical on every render and on the server. */
function scatterStars(count: number): Star[] {
  let seed = 20261004;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  return Array.from({ length: count }, () => {
    const y = random() * 470;
    return {
      x: random() * 1440,
      y,
      r: 0.7 + random() * 1.3,
      // Stars fade as the sky lightens toward the horizon.
      opacity: (0.25 + random() * 0.6) * (1 - y / 620),
    };
  });
}

const STARS = scatterStars(70);

// Wide, flat bands of light whose ends fall outside the frame, so they read as layers of sky.
const skyBands = [
  { rx: 1500, ry: 470, fill: "var(--ink)" },
  { rx: 1300, ry: 300, fill: "color-mix(in srgb, var(--ink) 84%, var(--terracotta))" },
  { rx: 1120, ry: 170, fill: "color-mix(in srgb, var(--ink) 60%, var(--terracotta))" },
  { rx: 800, ry: 86, fill: "color-mix(in srgb, var(--terracotta) 62%, var(--dawn))" },
  { rx: 380, ry: 44, fill: "color-mix(in srgb, var(--dawn) 78%, var(--sand))" },
];

export function DawnScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 1000"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      className={cn("pointer-events-none", className)}
    >
      <defs>
        <linearGradient id="dawn-road" x1="0" y1="666" x2="0" y2="1000" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "color-mix(in srgb, var(--dawn) 55%, var(--ink))" }} />
          <stop offset="1" style={{ stopColor: "color-mix(in srgb, var(--sand) 16%, var(--night))" }} />
        </linearGradient>
        <mask id="dawn-road-reveal" maskUnits="userSpaceOnUse" x="0" y="600" width="1440" height="400">
          <path
            d={ROAD_CENTRE}
            pathLength={1}
            stroke="white"
            strokeWidth="300"
            strokeDasharray="1 1"
            className="animate-road-draw"
          />
        </mask>
      </defs>

      <rect width="1440" height="1000" fill="var(--night)" />
      {skyBands.map(({ rx, ry, fill }) => (
        <ellipse key={rx} cx="720" cy="676" rx={rx} ry={ry} style={{ fill }} />
      ))}
      <g fill="var(--sand)">
        {STARS.map((star, index) => (
          <circle key={index} cx={star.x} cy={star.y} r={star.r} opacity={star.opacity} />
        ))}
      </g>

      <circle cx="720" cy="684" r="88" fill="none" stroke="var(--dawn)" strokeWidth="1.5" opacity="0.5" />
      <circle cx="720" cy="684" r="60" fill="var(--dawn)" />

      {/* Far ridge, with a rim of dawn light where it faces the sun. */}
      <path
        d="M0 640C160 610 300 600 430 628S610 668 720 668 900 645 1010 626 1300 612 1440 640V1000H0z"
        style={{ fill: "color-mix(in srgb, var(--ink) 84%, var(--terracotta))" }}
      />
      <path
        d="M330 612C380 614 404 620 430 628S610 668 720 668 900 645 1010 626C1050 619 1080 614 1120 612"
        fill="none"
        stroke="var(--dawn)"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.75"
      />

      <path d="M0 700C220 680 420 690 600 700S760 705 840 700 1240 680 1440 696V1000H0z" fill="var(--ink)" />
      <path
        d="M0 800C180 770 330 778 470 800S760 812 900 800 1260 772 1440 792V1000H0z"
        style={{ fill: "color-mix(in srgb, var(--ink) 55%, var(--night))" }}
      />

      <g mask="url(#dawn-road-reveal)">
        <path d={ROAD_SURFACE} fill="url(#dawn-road)" />
        <path d={ROAD_SURFACE} fill="none" stroke="var(--sand)" strokeOpacity="0.22" strokeWidth="1.5" />
        <g fill="none" stroke="var(--dawn)" strokeLinecap="round">
          <path d="M720 1000C720 940 560 900 600 840" strokeWidth="5" strokeDasharray="22 18" />
          <path d="M600 840C640 780 820 760 790 720" strokeWidth="2.5" strokeDasharray="10 10" opacity="0.85" />
          <path d="M790 720C770 695 720 685 722 666" strokeWidth="1.2" strokeDasharray="4 5" opacity="0.7" />
        </g>
      </g>

      {/* The lantern at the start of the road, and the pool of light it throws. */}
      <ellipse cx="720" cy="940" rx="150" ry="26" fill="var(--dawn)" opacity="0.12" />
      <ellipse cx="720" cy="940" rx="74" ry="12" fill="var(--dawn)" opacity="0.2" />
      <Lantern x="678" y="846" width="84" height="94.5" className="text-sand" />

      <path d="M0 1000V968C200 948 420 952 560 962S780 970 900 960 1280 950 1440 966V1000z" fill="var(--night)" />
    </svg>
  );
}
