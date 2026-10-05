import { setRequestLocale } from "next-intl/server";

import { ClosingStop } from "@/components/home/closing-stop";
import { HomeHero } from "@/components/home/home-hero";
import { MeetRafiqStop } from "@/components/home/meet-rafiq-stop";
import { OffersStop } from "@/components/home/offers-stop";
import { TrustStop } from "@/components/home/trust-stop";
import { WhyStop } from "@/components/home/why-stop";
import { RoadJourney } from "@/components/journey/road-journey";
import { features } from "@/config/features";
import { PageMessages } from "@/i18n/client-messages";
import { resolveLocale } from "@/i18n/locale";

// Rendered at build time: a request-time API here fails the build instead of making the page
// dynamic (and slow to open). See scripts/check-static.mjs.
export const dynamic = "error";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);

  return (
    <PageMessages page="home">
      <HomeHero />
      <RoadJourney>
        <WhyStop />
        <OffersStop />
        {features.rafiq && <MeetRafiqStop />}
        <TrustStop />
        <ClosingStop />
      </RoadJourney>
    </PageMessages>
  );
}
