import { getTranslations } from "next-intl/server";

import { RoadStop } from "@/components/journey/road-stop";
import { StationMarker } from "@/components/journey/station";
import { SectionHeading } from "@/components/ui/section-heading";
import { features } from "@/config/features";
import { Link } from "@/i18n/navigation";

type Offer = "learn" | "practice" | "rafiq" | "specialists";

// Each door with one of the project's own drawings (content/art/icons), served by /art.
const OFFERS: readonly { key: Offer; href: `/${string}`; drawing: string; on: boolean }[] = [
  { key: "learn", href: "/learn", drawing: "road", on: features.learn },
  { key: "practice", href: "/practice", drawing: "footsteps", on: features.practice },
  { key: "rafiq", href: "/rafiq", drawing: "lantern", on: features.rafiq },
  { key: "specialists", href: "/talk-to-a-specialist", drawing: "speech", on: true },
];

/** What the platform offers, in a few words: one drawing and one line per door, each opening it. */
export async function OffersStop() {
  const t = await getTranslations("Home.offers");

  return (
    <section aria-labelledby="offers-title" className="journey-dawn pt-4 pb-24 md:pb-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <RoadStop
          side="end"
          className="tone-night"
          marker={
            <StationMarker lightOnReach>
              <span className="font-display text-lg font-semibold">4</span>
            </StationMarker>
          }
        >
          <SectionHeading id="offers-title" eyebrow={t("eyebrow")} title={t("title")} />
        </RoadStop>
        <ul className="relative z-10 mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {OFFERS.filter((offer) => offer.on).map(({ key, href, drawing }) => (
            <li key={key}>
              <Link
                href={href}
                className="tone-day group grid h-full content-start gap-3 rounded-3xl border border-hairline bg-paper p-5 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-dawn motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- an inert SVG drawing; nothing to optimise */}
                <img src={`/art/icons/${drawing}.svg`} alt="" width={56} height={56} className="size-14" />
                <span className="font-display text-xl font-semibold group-hover:underline group-hover:underline-offset-4">{t(`${key}.title`)}</span>
                <span className="leading-relaxed text-muted-foreground">{t(`${key}.line`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
