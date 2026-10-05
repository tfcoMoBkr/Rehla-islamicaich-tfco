import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/*
 * Original drawings for the Mawqif situations, in the road-at-dawn palette: everyday objects and
 * places, never a religious symbol used as decoration. They are decorative; each situation is
 * named in text beside its drawing.
 */

const INK = "var(--ink)";
const SAND = "var(--sand)";
const PAPER = "var(--paper)";
const DAWN = "var(--dawn)";
const OASIS = "var(--oasis)";
const TERRA = "var(--terracotta)";
const LINE = "var(--hairline)";

function Ground() {
  return <path d="M0 98c30-6 60-6 90-2s50 4 70-1v25H0z" fill={SAND} />;
}

function Bubble({ x, y, w, flip = false, fill = PAPER }: { x: number; y: number; w: number; flip?: boolean; fill?: string }) {
  const tail = flip ? `M${x + w - 14} ${y + 22}l8 10 2-10z` : `M${x + 12} ${y + 22}l-6 10 12-10z`;
  return (
    <g>
      <rect x={x} y={y} width={w} height={24} rx={12} fill={fill} stroke={INK} strokeWidth="2" />
      <path d={tail} fill={fill} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d={`M${x + 12} ${y + 12}h${w - 24}`} stroke={LINE} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

function Person({ x, color }: { x: number; color: string }) {
  return (
    <g>
      <circle cx={x} cy={58} r={9} fill={color} />
      <path d={`M${x - 14} 98c0-16 6-26 14-26s14 10 14 26z`} fill={color} />
    </g>
  );
}

const SCENES: Record<string, () => ReactNode> = {
  greeting: () => (
    <>
      <Ground />
      <Person x={52} color={OASIS} />
      <Person x={108} color={TERRA} />
      <Bubble x={22} y={16} w={56} />
      <Bubble x={82} y={24} w={56} flip fill={DAWN} />
    </>
  ),
  mosque: () => (
    <>
      <Ground />
      <rect x={52} y={24} width={56} height={74} rx={4} fill={PAPER} stroke={INK} strokeWidth="2" />
      <rect x={66} y={42} width={28} height={56} rx={14} fill={OASIS} />
      <rect x={24} y={86} width={22} height={6} rx={3} fill={TERRA} />
      <rect x={114} y={86} width={22} height={6} rx={3} fill={INK} />
      <circle cx={130} cy={22} r={8} fill={DAWN} opacity={0.85} />
    </>
  ),
  adhan: () => (
    <>
      <Ground />
      <rect x={22} y={40} width={64} height={58} rx={4} fill={PAPER} stroke={INK} strokeWidth="2" />
      <rect x={34} y={54} width={18} height={18} fill={DAWN} opacity={0.7} />
      <rect x={58} y={54} width={18} height={18} fill={DAWN} opacity={0.7} />
      {[0, 1, 2].map((ring) => (
        <path key={ring} d={`M${100 + ring * 12} ${38 - ring * 8}q${10 + ring * 4} ${22 + ring * 8} 0 ${44 + ring * 16}`} fill="none" stroke={OASIS} strokeWidth="3" strokeLinecap="round" opacity={1 - ring * 0.25} />
      ))}
    </>
  ),
  eating: () => (
    <>
      <Ground />
      <ellipse cx={80} cy={78} rx={52} ry={14} fill={PAPER} stroke={INK} strokeWidth="2" />
      <ellipse cx={80} cy={74} rx={30} ry={8} fill={TERRA} />
      <circle cx={70} cy={70} r={4} fill={DAWN} />
      <circle cx={88} cy={71} r={3} fill={OASIS} />
      <rect x={124} y={40} width={16} height={30} rx={3} fill={PAPER} stroke={INK} strokeWidth="2" />
      <path d="M124 52h16" stroke={OASIS} strokeWidth="6" />
    </>
  ),
  sneezing: () => (
    <>
      <Ground />
      <rect x={48} y={56} width={64} height={40} rx={4} fill={OASIS} />
      <path d="M68 56c4-18 20-18 24 0" fill={PAPER} stroke={INK} strokeWidth="2" />
      {[0, 1, 2].map((dot) => (
        <circle key={dot} cx={36 - dot * 8} cy={40 - dot * 6} r={3 - dot * 0.6} fill={DAWN} />
      ))}
      <Bubble x={96} y={18} w={50} flip />
    </>
  ),
  home: () => (
    <>
      <Ground />
      <path d="M40 54l40-30 40 30v44H40z" fill={PAPER} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <rect x={68} y={66} width={24} height={32} rx={3} fill={TERRA} />
      <circle cx={87} cy={82} r={2} fill={DAWN} />
      <rect x={48} y={64} width={14} height={14} fill={DAWN} opacity={0.6} />
      <rect x={98} y={64} width={14} height={14} fill={DAWN} opacity={0.6} />
    </>
  ),
  invitation: () => (
    <>
      <Ground />
      <rect x={30} y={30} width={70} height={46} rx={4} fill={PAPER} stroke={INK} strokeWidth="2" />
      <path d="M30 32l35 24 35-24" fill="none" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx={120} cy={86} rx={26} ry={8} fill={PAPER} stroke={INK} strokeWidth="2" />
      <ellipse cx={120} cy={83} rx={14} ry={4} fill={TERRA} />
      <circle cx={128} cy={24} r={8} fill={DAWN} />
    </>
  ),
  sick: () => (
    <>
      <Ground />
      <rect x={30} y={62} width={100} height={20} rx={4} fill={PAPER} stroke={INK} strokeWidth="2" />
      <rect x={34} y={54} width={26} height={12} rx={6} fill={LINE} />
      <path d="M30 82v14M130 82v14" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <rect x={118} y={30} width={14} height={20} rx={3} fill={OASIS} opacity={0.7} />
      <circle cx={121} cy={26} r={5} fill={TERRA} />
      <circle cx={130} cy={24} r={5} fill={DAWN} />
    </>
  ),
  condolence: () => (
    <>
      <Ground />
      <path d="M44 74h24v14a8 8 0 0 1-8 8h-8a8 8 0 0 1-8-8z" fill={PAPER} stroke={INK} strokeWidth="2" />
      <path d="M92 74h24v14a8 8 0 0 1-8 8h-8a8 8 0 0 1-8-8z" fill={PAPER} stroke={INK} strokeWidth="2" />
      <path d="M52 66c0-6 6-6 6-12M100 66c0-6 6-6 6-12" fill="none" stroke={LINE} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M60 40c10-14 30-14 40 0" fill="none" stroke={DAWN} strokeWidth="3" strokeLinecap="round" opacity={0.8} />
    </>
  ),
  colleague: () => (
    <>
      <Ground />
      <rect x={24} y={66} width={112} height={8} rx={3} fill={INK} />
      <path d="M36 74v24M124 74v24" stroke={INK} strokeWidth="3" />
      <rect x={60} y={42} width={40} height={24} rx={3} fill={PAPER} stroke={INK} strokeWidth="2" />
      <Bubble x={18} y={14} w={50} />
      <Bubble x={94} y={14} w={50} flip fill={DAWN} />
    </>
  ),
  friday: () => (
    <>
      <Ground />
      <rect x={40} y={28} width={80} height={66} rx={6} fill={PAPER} stroke={INK} strokeWidth="2" />
      <rect x={40} y={28} width={80} height={16} rx={6} fill={TERRA} />
      {[0, 1, 2, 3, 4, 5, 6].map((day) => (
        <rect key={day} x={48 + (day % 4) * 18} y={52 + Math.floor(day / 4) * 18} width={12} height={12} rx={2} fill={day === 5 ? OASIS : LINE} />
      ))}
    </>
  ),
  fasting: () => (
    <>
      <path d="M0 0h160v120H0z" fill="none" />
      <circle cx={80} cy={70} r={20} fill={DAWN} opacity={0.85} />
      <Ground />
      <rect x={108} y={60} width={14} height={30} rx={3} fill={PAPER} stroke={INK} strokeWidth="2" />
      <path d="M108 74h14" stroke={OASIS} strokeWidth="8" />
      <ellipse cx={42} cy={88} rx={18} ry={6} fill={PAPER} stroke={INK} strokeWidth="2" />
      <ellipse cx={36} cy={84} rx={5} ry={3} fill={TERRA} />
      <ellipse cx={46} cy={84} rx={5} ry={3} fill={TERRA} />
    </>
  ),
};

export const SITUATION_ART = Object.keys(SCENES);

export function SituationArt({ art, className }: { art: string; className?: string }) {
  const Scene = SCENES[art];
  return (
    <svg viewBox="0 0 160 120" aria-hidden="true" className={cn("h-auto w-full", className)}>
      {Scene ? <Scene /> : <Ground />}
    </svg>
  );
}
