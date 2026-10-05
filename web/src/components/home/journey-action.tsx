"use client";

import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { useProgress } from "@/lib/learn/progress-store";

/**
 * The journey's call to action: "start your road" until the learner has chosen a starting point
 * or finished a lesson on this device, then "continue your road". The labels come from the page.
 */
export function JourneyAction({ start, resume, className }: { start: string; resume: string; className?: string }) {
  const progress = useProgress();
  const started = progress.startStation !== null || Object.keys(progress.completedLessons).length > 0;

  return (
    <Button asChild size="lg" className={className}>
      <Link href="/learn">
        {started ? resume : start}
        <ArrowRight aria-hidden className="rtl:-scale-x-100" />
      </Link>
    </Button>
  );
}
