import {
  Backpack,
  Footprints,
  MessagesSquare,
  PersonStanding,
  ScanText,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Lantern } from "@/components/journey/lantern";
import { RoadStop } from "@/components/journey/road-stop";
import { Station } from "@/components/journey/station";
import { SectionHeading } from "@/components/ui/section-heading";
import { features, sections, type Feature } from "@/config/features";

const icons: Record<Feature, LucideIcon | typeof Lantern> = {
  learn: Footprints,
  practice: Backpack,
  rafiq: Lantern,
  mawqif: MessagesSquare,
  adasa: ScanText,
  community: UsersRound,
  aqim: PersonStanding,
};

/**
 * Every section of the product as a station on the road, in the order of features.ts. A section
 * that is on is a lit station whose card opens it; one that is off is an unlit station marked
 * "Soon", not a link. Turning a flag on lights its station with no other change.
 */
export async function StationsStop() {
  const t = await getTranslations("Home.stations");

  return (
    <section aria-labelledby="stations-title" className="journey-dawn pt-4 pb-24 md:pb-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <RoadStop side="end" className="tone-night">
          <SectionHeading
            id="stations-title"
            eyebrow={t("eyebrow")}
            title={t("title")}
            description={t("description")}
          />
        </RoadStop>

        <ol className="mt-12 space-y-10 md:mt-16 md:space-y-0 md:[&>li+li]:-mt-10">
          {sections.map(({ feature, href }, index) => {
            const Icon = icons[feature];
            const on = features[feature];
            return (
              <Station
                key={feature}
                side={index % 2 === 0 ? "start" : "end"}
                lightOnReach={on}
                // Not faded: over the dawn gradient a faded card loses its contrast; the marker and "Soon" say it.
                dimmed={false}
                href={on ? href : undefined}
                label={t("label", { number: index + 1 })}
                title={t(`${feature}.name`)}
                icon={<Icon />}
                meta={
                  on ? undefined : (
                    <span className="rounded-full border border-hairline bg-sand px-2 py-0.5 text-xs font-semibold text-ink">
                      {t("soon")}
                    </span>
                  )
                }
              >
                <p>{t(`${feature}.body`)}</p>
              </Station>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
