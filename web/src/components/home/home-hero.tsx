import { getTranslations } from "next-intl/server";

import { RafiqFigure } from "@/components/rafiq/rafiq-figure";
import { Button } from "@/components/ui/button";
import { features } from "@/config/features";
import { Link } from "@/i18n/navigation";

import { DawnScene } from "./dawn-scene";
import { JourneyAction } from "./journey-action";

export async function HomeHero() {
  const t = await getTranslations("Home");

  return (
    <section
      aria-labelledby="hero-title"
      className="tone-night relative isolate overflow-hidden bg-background"
    >
      <DawnScene className="absolute inset-0 -z-10 size-full" />
      {/* Rafiq greets the traveller at the start of the road, in the pool of light the scene draws there. */}
      <RafiqFigure
        pose="hello"
        height={320}
        priority
        className="animate-rise-in absolute inset-x-0 bottom-[4%] -z-10 mx-auto h-[min(30svh,18rem)] w-auto [animation-delay:500ms]"
      />
      <div className="mx-auto flex min-h-[calc(100svh-7rem)] max-w-3xl flex-col items-center px-4 pt-12 pb-[36svh] text-center sm:px-6 md:min-h-[calc(100svh-4.5rem)] md:pt-16 md:pb-[38svh]">
        <p className="animate-rise-in font-semibold text-dawn">{t("eyebrow")}</p>
        <h1
          id="hero-title"
          className="animate-rise-in mt-3 font-display text-7xl leading-[1.15] font-bold [animation-delay:120ms] sm:text-8xl"
        >
          {t("title")}
        </h1>
        {/* Sand on the night bands, never the muted tone: the tagline is read at a glance. */}
        <p className="animate-rise-in mt-3 font-display text-2xl leading-snug font-semibold text-foreground [animation-delay:240ms] sm:text-3xl">
          {t("tagline")}
        </p>
        <div className="animate-rise-in mt-8 flex w-full flex-col items-center gap-3 [animation-delay:380ms] sm:w-auto sm:flex-row sm:justify-center">
          {features.learn && (
            <JourneyAction start={t("startRoad")} resume={t("continueRoad")} className="w-full max-w-xs sm:w-auto" />
          )}
          <Button asChild size="lg" variant="outline" className="w-full max-w-xs bg-night/40 sm:w-auto">
            <Link href="/talk-to-a-specialist">{t("askSpecialist")}</Link>
          </Button>
        </div>
        {/* On its own night panel: the scene's bands behind it change with the screen's height. */}
        <p className="animate-rise-in mt-4 max-w-md rounded-2xl bg-night/80 px-4 py-2.5 text-base leading-relaxed text-foreground [animation-delay:440ms]">
          {t("askSpecialistLine")}
        </p>
      </div>
    </section>
  );
}
