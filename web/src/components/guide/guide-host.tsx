"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

import { usePathname } from "@/i18n/navigation";
import { tourMayOpen, useChoiceOpen } from "@/lib/account/choice";
import { useGuideVisible, wasAskedFor } from "@/lib/guide-store";
import type { TourSample } from "@/lib/learn/tour";

// Only a learner entering Khutuwat for the first time (or one who asks) downloads the tour.
const GuidePanel = dynamic(() => import("./guide-panel").then((module) => module.GuidePanel));

/** The Khutuwat tour, on the learn page: shown on the first visit and whenever it is asked for. */
export function TourHost({ sample }: { sample: TourSample }) {
  // The account-or-guest choice comes first; the tour opens once it is answered.
  const visible = tourMayOpen(useGuideVisible(), useChoiceOpen(usePathname()));
  // Its own boundary: the page never waits for the tour's code to arrive.
  return visible ? (
    <Suspense fallback={null}>
      <GuidePanel sample={sample} focus={wasAskedFor()} />
    </Suspense>
  ) : null;
}
