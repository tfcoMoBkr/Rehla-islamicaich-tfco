import {
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
import type { Feature } from "@/config/features";

// Every section of the product, shown as what the journey offers. These are deliberately
// not links: most sections are still behind their feature flags.
const stations: readonly { feature: Feature; icon: LucideIcon | typeof Lantern }[] = [
  { feature: "learn", icon: Footprints },
  { feature: "rafiq", icon: Lantern },
  { feature: "mawqif", icon: MessagesSquare },
  { feature: "adasa", icon: ScanText },
  { feature: "community", icon: UsersRound },
  { feature: "aqim", icon: PersonStanding },
];

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
          {stations.map(({ feature, icon: Icon }, index) => (
            <Station
              key={feature}
              side={index % 2 === 0 ? "start" : "end"}
              lightOnReach
              label={t("label", { number: index + 1 })}
              title={t(`${feature}.name`)}
              icon={<Icon />}
            >
              <p>{t(`${feature}.body`)}</p>
            </Station>
          ))}
        </ol>
      </div>
    </section>
  );
}
