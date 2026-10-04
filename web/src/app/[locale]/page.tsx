import { setRequestLocale } from "next-intl/server";

import { HomeHero } from "@/components/home/home-hero";
import { PrinciplesStop } from "@/components/home/principles-stop";
import { StationsStop } from "@/components/home/stations-stop";
import { WhyStop } from "@/components/home/why-stop";
import { RoadJourney } from "@/components/journey/road-journey";
import { resolveLocale } from "@/i18n/locale";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);

  return (
    <>
      <HomeHero />
      <RoadJourney>
        <WhyStop />
        <StationsStop />
        <PrinciplesStop />
      </RoadJourney>
    </>
  );
}
