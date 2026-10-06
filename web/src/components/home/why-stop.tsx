import { Signpost } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { RoadStop } from "@/components/journey/road-stop";
import { StationMarker } from "@/components/journey/station";
import { SectionHeading } from "@/components/ui/section-heading";

/** "Why Rehla?": where the road begins, the first stop before the stations of the journey. */
export async function WhyStop() {
  const t = await getTranslations("Home.why");

  return (
    <section aria-labelledby="why-title" className="tone-night bg-background pt-16 pb-16 md:pt-24 md:pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <RoadStop
          side="start"
          marker={
            <StationMarker lightOnReach>
              <Signpost />
            </StationMarker>
          }
        >
          <SectionHeading id="why-title" eyebrow={t("eyebrow")} title={t("title")} />
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{t("body")}</p>
          <p className="mt-6 max-w-2xl border-s-2 border-dawn ps-5 text-lg font-medium">{t("intro")}</p>
        </RoadStop>
      </div>
    </section>
  );
}
