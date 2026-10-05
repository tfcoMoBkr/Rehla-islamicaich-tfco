"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

import { useGuideVisible, wasAskedFor } from "@/lib/guide-store";
import type { TourSample } from "@/lib/learn/tour";

// Only a learner entering Khutuwat for the first time (or one who asks) downloads the tour.
const GuidePanel = dynamic(() => import("./guide-panel").then((module) => module.GuidePanel));

/** The Khutuwat tour, on the learn page: shown on the first visit and whenever it is asked for. */
export function TourHost({ sample }: { sample: TourSample }) {
  const visible = useGuideVisible();
  // Its own boundary: the page never waits for the tour's code to arrive.
  return visible ? (
    <Suspense fallback={null}>
      <GuidePanel sample={sample} focus={wasAskedFor()} />
    </Suspense>
  ) : null;
}
