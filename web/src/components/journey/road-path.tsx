"use client";

import { useId, useLayoutEffect, useRef } from "react";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { lengthAtHeight, sampleByHeight } from "@/lib/road";
import { cn } from "@/lib/utils";

const SAMPLE_COUNT = 240;
/** The traveller walks at this fraction of the viewport height. */
const TRAVELLER_LINE = 0.68;

type RoadPathProps = {
  d: string;
  width: number;
  height: number;
  /** Receives the traveller's height in the road's own coordinates as it moves. */
  onTravel?: (y: number) => void;
  className?: string;
};

/**
 * A hand-drawn road that draws itself as the page scrolls, with the lantern's light
 * travelling at its tip. With reduced motion it is drawn in full and holds still.
 */
export function RoadPath({ d, width, height, onTravel, className }: RoadPathProps) {
  const id = useId().replace(/[^\w-]/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const routeRef = useRef<SVGPathElement>(null);
  const revealRef = useRef<SVGPathElement>(null);
  const travellerRef = useRef<SVGGElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useLayoutEffect(() => {
    const svg = svgRef.current;
    const route = routeRef.current;
    const reveal = revealRef.current;
    const traveller = travellerRef.current;
    if (!svg || !route || !reveal || !traveller) {
      return;
    }

    if (reducedMotion) {
      reveal.style.strokeDashoffset = "0";
      traveller.style.opacity = "0";
      onTravel?.(Number.POSITIVE_INFINITY);
      return;
    }

    const total = route.getTotalLength();
    const samples = sampleByHeight(route, SAMPLE_COUNT);
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.innerHeight * TRAVELLER_LINE - svg.getBoundingClientRect().top;
      const length = lengthAtHeight(samples, y);
      const tip = route.getPointAtLength(length);

      reveal.style.strokeDashoffset = String(1 - length / total);
      traveller.style.opacity = length > 0 && length < total ? "1" : "0";
      traveller.setAttribute("transform", `translate(${tip.x} ${tip.y})`);
      onTravel?.(y);
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [d, reducedMotion, onTravel]);

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      className={cn("pointer-events-none overflow-visible", className)}
    >
      <defs>
        <linearGradient id={`${id}-ink`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={height}>
          <stop offset="0" style={{ stopColor: "var(--road-from)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--road-via)" }} />
          <stop offset="1" style={{ stopColor: "var(--road-to)" }} />
        </linearGradient>
        <linearGradient id={`${id}-bed`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={height}>
          <stop offset="0" style={{ stopColor: "var(--road-bed-from)" }} />
          <stop offset="1" style={{ stopColor: "var(--road-bed-to)" }} />
        </linearGradient>
        <mask id={`${id}-reveal`} maskUnits="userSpaceOnUse" x="-40" y="-40" width={width + 80} height={height + 80}>
          <path
            ref={revealRef}
            d={d}
            pathLength={1}
            stroke="white"
            strokeWidth="48"
            strokeLinecap="round"
            strokeDasharray="1 1"
            strokeDashoffset="0"
          />
        </mask>
      </defs>

      <g mask={`url(#${id}-reveal)`} strokeLinecap="round" strokeLinejoin="round">
        <path d={d} stroke={`url(#${id}-bed)`} strokeWidth="14" />
        <path ref={routeRef} d={d} stroke={`url(#${id}-ink)`} strokeWidth="2.5" />
        {/* A second, offset pencil line gives the road its hand-drawn wobble. */}
        <path
          d={d}
          stroke={`url(#${id}-ink)`}
          strokeWidth="1"
          strokeDasharray="14 9 3 9"
          opacity="0.55"
          transform="translate(3 2)"
        />
      </g>

      <g ref={travellerRef} style={{ opacity: 0 }} className="transition-opacity duration-300">
        <circle r="11" fill="var(--dawn)" opacity="0.18" />
        <circle r="5" fill="var(--dawn)" />
      </g>
    </svg>
  );
}
