import { getTranslations } from "next-intl/server";

import { Lantern } from "@/components/journey/lantern";
import { RoadStop } from "@/components/journey/road-stop";
import { StationMarker } from "@/components/journey/station";
import { MeetRafiq } from "@/components/rafiq/meet-rafiq";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** The companion on the road: Rafiq introduces himself, then invites the visitor to his page. */
export async function MeetRafiqStop() {
  const t = await getTranslations("MeetRafiq");

  return (
    <section aria-labelledby="meet-rafiq" className="pt-4 pb-24 md:pb-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <RoadStop
          side="start"
          marker={
            <StationMarker lightOnReach>
              <Lantern />
            </StationMarker>
          }
        >
          <MeetRafiq
            id="meet-rafiq"
            action={
              <Button asChild size="lg" className="justify-self-start">
                <Link href="/rafiq">{t("start")}</Link>
              </Button>
            }
          />
        </RoadStop>
      </div>
    </section>
  );
}
