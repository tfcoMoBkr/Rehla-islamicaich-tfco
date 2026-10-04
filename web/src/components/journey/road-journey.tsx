"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { ROAD_ANCHOR_ATTRIBUTE, buildRoadPath, type Point } from "@/lib/road";
import { cn } from "@/lib/utils";

import { RoadPath } from "./road-path";

type Geometry = { d: string; width: number; height: number };

const MD_BREAKPOINT = 768;

function centreOf(element: Element, origin: DOMRect): Point {
  const box = element.getBoundingClientRect();
  return {
    x: box.left + box.width / 2 - origin.left,
    y: box.top + box.height / 2 - origin.top,
  };
}

/**
 * Lays a road under its children that starts at the top centre and passes through every
 * descendant marked with `data-road-anchor`. Anchors light up as the traveller reaches them.
 */
export function RoadJourney({ children, className }: { children: ReactNode; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorsRef = useRef<{ element: HTMLElement; y: number }[]>([]);
  const [geometry, setGeometry] = useState<Geometry | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const measure = () => {
      const origin = container.getBoundingClientRect();
      const anchors = Array.from(
        container.querySelectorAll<HTMLElement>(`[${ROAD_ANCHOR_ATTRIBUTE}]`),
      ).map((element) => ({ element, ...centreOf(element, origin) }));

      anchorsRef.current = anchors.map(({ element, y }) => ({ element, y }));
      setGeometry({
        width: origin.width,
        height: origin.height,
        d: buildRoadPath(
          [{ x: origin.width / 2, y: 0 }, ...anchors],
          origin.width < MD_BREAKPOINT ? 12 : 40,
        ),
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const lightReachedAnchors = useCallback((travellerY: number) => {
    for (const { element, y } of anchorsRef.current) {
      element.setAttribute("data-reached", String(y <= travellerY));
    }
  }, []);

  return (
    <div ref={containerRef} className={cn("relative isolate", className)}>
      {geometry && (
        <RoadPath
          {...geometry}
          onTravel={lightReachedAnchors}
          // Anchor coordinates are physical (measured from the left edge) in both directions.
          className="absolute top-0 left-0 z-0"
        />
      )}
      {children}
    </div>
  );
}
