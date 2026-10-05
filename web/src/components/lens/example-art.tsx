import type { ExampleId } from "@/lib/lens/examples";
import { cn } from "@/lib/utils";

/*
 * Original drawings for the Lens examples, in the road-at-dawn palette. They are decorative: each
 * example card names what it shows in text. No religious symbol is used as decoration.
 */

function Ground() {
  return <path d="M0 104c26-6 52-6 80-2s54 4 80-2v20H0z" fill="var(--sand)" />;
}

function MosqueSign() {
  return (
    <>
      <Ground />
      <rect x="76" y="44" width="8" height="62" rx="2" fill="var(--ink)" />
      <path d="M30 22h86l14 14-14 14H30a6 6 0 0 1-6-6V28a6 6 0 0 1 6-6z" fill="var(--oasis)" />
      <path d="M30 22h86l14 14-14 14H30a6 6 0 0 1-6-6V28a6 6 0 0 1 6-6z" fill="none" stroke="var(--ink)" strokeWidth="2" />
      <text x="72" y="42" textAnchor="middle" fontSize="18" fontFamily="var(--font-reem-kufi), serif" fill="var(--paper)">
        مسجد
      </text>
      <circle cx="132" cy="18" r="8" fill="var(--dawn)" opacity="0.85" />
    </>
  );
}

function PrayerMat() {
  return (
    <>
      <Ground />
      <g transform="rotate(-8 80 64)">
        <rect x="42" y="18" width="76" height="92" rx="4" fill="var(--terracotta)" />
        <rect x="50" y="26" width="60" height="76" rx="2" fill="none" stroke="var(--dawn)" strokeWidth="3" />
        <rect x="58" y="34" width="44" height="60" rx="2" fill="none" stroke="var(--paper)" strokeWidth="1.5" strokeDasharray="4 3" />
        <path d="M80 48l13 16-13 16-13-16z" fill="none" stroke="var(--dawn)" strokeWidth="2" strokeLinejoin="round" />
        {[46, 54, 62, 70, 78, 86, 94, 102, 110].map((x) => (
          <path key={x} d={`M${x} 110v6`} stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" />
        ))}
      </g>
    </>
  );
}

function WuduArea() {
  return (
    <>
      <Ground />
      <rect x="18" y="20" width="124" height="14" rx="3" fill="var(--hairline)" />
      {[40, 80, 120].map((x) => (
        <g key={x}>
          <path d={`M${x} 34v10h8`} fill="none" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path d={`M${x + 8} 50c-2 4-2 7 0 9 2-2 2-5 0-9z`} fill="var(--oasis)" />
          <path d={`M${x + 8} 64c-1.5 3-1.5 5 0 7 1.5-2 1.5-4 0-7z`} fill="var(--oasis)" opacity="0.7" />
        </g>
      ))}
      <rect x="14" y="78" width="132" height="18" rx="9" fill="var(--paper)" stroke="var(--ink)" strokeWidth="2" />
      <path d="M26 87h108" stroke="var(--oasis)" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
    </>
  );
}

function Calligraphy({ word }: { word: string }) {
  return (
    <>
      <rect x="16" y="16" width="128" height="88" rx="6" fill="var(--paper)" stroke="var(--hairline)" strokeWidth="2" />
      <path d="M30 84c28-8 72-8 100 0" fill="none" stroke="var(--dawn)" strokeWidth="5" strokeLinecap="round" opacity="0.8" />
      <text x="80" y="70" textAnchor="middle" fontSize="34" fontFamily="var(--font-reem-kufi), serif" fill="var(--ink)">
        {word}
      </text>
    </>
  );
}

export function ExampleArt({ id, word, className }: { id: ExampleId; word: string; className?: string }) {
  return (
    <svg viewBox="0 0 160 120" aria-hidden="true" className={cn("h-auto w-full", className)}>
      {id === "mosque" && <MosqueSign />}
      {id === "prayerMat" && <PrayerMat />}
      {id === "wudu" && <WuduArea />}
      {id === "calligraphy" && <Calligraphy word={word} />}
    </svg>
  );
}
