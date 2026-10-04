import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { features } from "@/config/features";
import { Link } from "@/i18n/navigation";

import { DawnScene } from "./dawn-scene";

export async function HomeHero() {
  const t = await getTranslations("Home");

  return (
    <section
      aria-labelledby="hero-title"
      className="tone-night relative isolate overflow-hidden bg-background"
    >
      <DawnScene className="absolute inset-0 -z-10 size-full" />
      <div className="mx-auto flex min-h-[calc(100svh-7rem)] max-w-3xl flex-col items-center px-4 pt-14 pb-[42svh] text-center sm:px-6 md:min-h-[calc(100svh-4.5rem)] md:pt-16 md:pb-[40svh]">
        <p className="animate-rise-in font-medium text-dawn">{t("eyebrow")}</p>
        <h1
          id="hero-title"
          className="animate-rise-in mt-3 font-display text-7xl leading-[1.15] font-bold [animation-delay:120ms] sm:text-8xl"
        >
          {t("title")}
        </h1>
        <p className="animate-rise-in mt-2 text-xl text-muted-foreground [animation-delay:240ms] sm:text-2xl">
          {t("tagline")}
        </p>
        {features.learn && (
          <Button asChild size="lg" className="animate-rise-in mt-9 [animation-delay:380ms]">
            <Link href="/learn">
              {t("cta")}
              <ArrowRight aria-hidden className="rtl:-scale-x-100" />
            </Link>
          </Button>
        )}
      </div>
    </section>
  );
}
