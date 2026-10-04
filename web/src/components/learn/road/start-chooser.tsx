"use client";

import { useTranslations } from "next-intl";

import { optionClassName } from "@/components/learn/interactions/option-styles";
import { Card } from "@/components/ui/card";
import { progressActions } from "@/lib/learn/progress-store";
import type { StationView } from "@/lib/learn/types";

/**
 * The learner states where they want to begin. Nothing is inferred from behaviour; the choice
 * can be changed at any time from a locked station.
 */
export function StartChooser({ stations }: { stations: readonly StationView[] }) {
  const t = useTranslations("Learn");

  return (
    <Card className="gap-4 px-6 sm:px-8">
      <h2 className="font-display text-2xl font-semibold">{t("chooseStartTitle")}</h2>
      <p className="text-muted-foreground">{t("chooseStartBody")}</p>
      <ul className="grid gap-2">
        {stations.map((station, index) => (
          <li key={station.id}>
            <button type="button" className={optionClassName} onClick={() => progressActions.chooseStart(station.id)}>
              <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-dawn font-display font-bold">
                {index + 1}
              </span>
              <span className="grid">
                <span>{station.title}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {index === 0 ? t("startFromBeginning") : t("startHere")}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
