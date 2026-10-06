"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import { Link } from "@/i18n/navigation";
import type { ReferralCentre } from "@/lib/content/schema";
import { associationsIn, centresByIds, citiesOf, nationalChannels, shown } from "@/lib/referral/centres";
import { chooseCity, useChosenCity } from "@/lib/referral/chosen-city";

import { CentreCard } from "./centre-card";
import { useReferralCentres } from "./centres-context";

type ViewProps = {
  /** The bodies the service named for this referral, as listed in content/referral-centers.json. */
  centres: readonly ReferralCentre[];
  city: string | null;
  onChooseCity: (city: string | null) => void;
  /** The learner said they live outside Saudi Arabia: lead with that, keep the city choice for later. */
  outside?: boolean;
};

/**
 * Who can help, after Rafiq refers: always the national channel (inside Saudi Arabia), then the
 * associations of the city the learner chooses (no location is read or guessed), a line for
 * learners elsewhere, and the full list. Every name and number comes from the data file.
 */
export function SpecialistCardView({ centres, city, onChooseCity, outside = false }: ViewProps) {
  const t = useTranslations("Specialist");
  const locale = useLocale();
  const pickerId = useId();
  const cities = citiesOf(centres);
  const known = city && cities.some((candidate) => candidate.ar === city) ? city : null;

  const fullList = (
    <Link href="/talk-to-a-specialist" className="justify-self-start font-semibold underline underline-offset-4">
      {t("fullList")}
    </Link>
  );
  if (outside) {
    return (
      <section aria-labelledby={`${pickerId}-title`} className="grid gap-3 rounded-2xl border border-oasis/30 bg-oasis/6 p-4">
        <h3 id={`${pickerId}-title`} className="font-display text-lg font-semibold">
          {t("cardTitle")}
        </h3>
        <p className="font-semibold">{t("outside")}</p>
        {fullList}
        <details className="grid gap-3">
          <summary className="cursor-pointer font-medium">{t("insideKingdom")}</summary>
          <div className="mt-3 grid gap-3">
            {nationalChannels(centres).map((centre) => (
              <CentreCard key={centre.id} centre={centre} compact />
            ))}
          </div>
        </details>
      </section>
    );
  }

  return (
    <section aria-labelledby={`${pickerId}-title`} className="grid gap-3 rounded-2xl border border-oasis/30 bg-oasis/6 p-4">
      <h3 id={`${pickerId}-title`} className="font-display text-lg font-semibold">
        {t("cardTitle")}
      </h3>
      {nationalChannels(centres).map((centre) => (
        <CentreCard key={centre.id} centre={centre} compact />
      ))}
      {cities.length > 0 && (
        <div className="grid gap-1.5">
          <label htmlFor={pickerId} className="text-sm font-semibold">
            {t("cityLabel")}
          </label>
          <select
            id={pickerId}
            value={known ?? ""}
            onChange={(event) => onChooseCity(event.target.value || null)}
            className="min-h-11 rounded-xl border-2 border-border bg-card px-3"
          >
            <option value="">{t("cityChoose")}</option>
            {cities.map((candidate) => {
              const label = shown(candidate, locale);
              return (
                <option key={candidate.ar} value={candidate.ar} lang={label.lang}>
                  {label.text}
                </option>
              );
            })}
          </select>
          <p className="text-xs text-muted-foreground">{t("cityHelp")}</p>
        </div>
      )}
      {associationsIn(centres, known).map((centre) => (
        <CentreCard key={centre.id} centre={centre} compact />
      ))}
      <p className="text-sm">{t("outside")}</p>
      {fullList}
    </section>
  );
}

export function SpecialistCard({ ids, outside = false }: { ids?: readonly string[]; outside?: boolean }) {
  const { centers } = useReferralCentres();
  const city = useChosenCity();
  return <SpecialistCardView centres={centresByIds(centers, ids)} city={city} onChooseCity={chooseCity} outside={outside} />;
}
