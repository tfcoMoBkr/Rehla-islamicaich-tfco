import {
  ArrowRight,
  BookMarked,
  LockKeyhole,
  ScrollText,
  Sunrise,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Lantern } from "@/components/journey/lantern";
import { RoadStop } from "@/components/journey/road-stop";
import { Stamp } from "@/components/journey/stamp";
import { StationMarker } from "@/components/journey/station";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { features } from "@/config/features";
import { Link } from "@/i18n/navigation";

type Principle = "attribution" | "referral" | "verbatim" | "transparency" | "privacy";

const principles: readonly { key: Principle; icon: LucideIcon | typeof Lantern }[] = [
  { key: "attribution", icon: BookMarked },
  { key: "referral", icon: UserRoundCheck },
  { key: "verbatim", icon: ScrollText },
  { key: "transparency", icon: Lantern },
  { key: "privacy", icon: LockKeyhole },
];

export async function PrinciplesStop() {
  const t = await getTranslations("Home");

  return (
    <section aria-labelledby="principles-title" className="pt-6 pb-32 md:pb-40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <RoadStop
          side="start"
          marker={
            <StationMarker lightOnReach>
              <Sunrise />
            </StationMarker>
          }
        >
          <SectionHeading
            id="principles-title"
            eyebrow={t("principles.eyebrow")}
            title={t("principles.title")}
          />
        </RoadStop>

        {/* The commitments, written out on a page of the travel journal. */}
        <div className="relative mx-auto mt-12 max-w-3xl">
          <Card className="px-6 py-4 sm:px-10 sm:py-6">
            <ul className="divide-y divide-dashed divide-hairline">
              {principles.map(({ key, icon: Icon }) => (
                <li key={key} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 py-5">
                  <span className="mt-1 grid size-10 place-items-center rounded-full border border-hairline text-oasis-text">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-semibold">
                      {t(`principles.${key}.title`)}
                    </h3>
                    <p className="mt-1 text-muted-foreground">{t(`principles.${key}.body`)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Stamp
            ringText={t("principles.stamp.ring")}
            center={t("principles.stamp.center")}
            rotate={-10}
            className="absolute -top-14 end-2 size-28 sm:-end-8 sm:size-32 md:-end-16 md:size-36"
          />
        </div>

        {features.learn && (
          <div className="mt-20 text-center">
            <p className="font-display text-3xl font-semibold sm:text-4xl">{t("closing.title")}</p>
            <p className="mt-3 text-lg text-muted-foreground">{t("closing.body")}</p>
            <Button asChild size="lg" className="mt-8">
              <Link href="/learn">
                {t("cta")}
                <ArrowRight aria-hidden className="rtl:-scale-x-100" />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
