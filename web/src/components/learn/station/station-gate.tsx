"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { progressActions, useProgress } from "@/lib/learn/progress-store";
import { stationStatuses, type RoadStation } from "@/lib/learn/road";

type StationGateProps = {
  route: readonly RoadStation[];
  stationId: string;
  stationTitle: string;
  children: ReactNode;
};

/**
 * Stations open in order, after the previous station's exam. A learner who already knows the
 * earlier material can say so and start here: their choice, never an inference.
 */
export function StationGate({ route, stationId, stationTitle, children }: StationGateProps) {
  const t = useTranslations("Learn");
  const progress = useProgress();
  const index = route.findIndex((station) => station.id === stationId);
  const locked = stationStatuses(route, progress)[index] === "locked";

  if (!locked) return children;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-20 pb-32 sm:px-6">
      <Card className="gap-4 px-6 sm:px-8">
        <Lock aria-hidden className="size-6 text-muted-foreground" />
        <h1 className="font-display text-2xl font-semibold">{t("gateTitle", { station: stationTitle })}</h1>
        <p className="text-muted-foreground">{t("gateBody")}</p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => progressActions.chooseStart(stationId)}>{t("startHereInstead")}</Button>
          <Button asChild variant="outline">
            <Link href="/learn">{t("backToRoad")}</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
