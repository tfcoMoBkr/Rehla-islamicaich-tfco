import { getTranslations } from "next-intl/server";

import { features } from "@/config/features";

import { JourneyAction } from "./journey-action";

/** Where the home page's road ends: the next step on the learner's own road. */
export async function ClosingStop() {
  const t = await getTranslations("Home");
  if (!features.learn) return null;

  return (
    <section aria-labelledby="closing-title" className="px-4 pb-32 text-center sm:px-6 md:pb-40">
      <h2 id="closing-title" className="font-display text-3xl font-semibold sm:text-4xl">
        {t("closing.title")}
      </h2>
      <p className="mt-3 text-lg text-muted-foreground">{t("closing.body")}</p>
      <JourneyAction start={t("startRoad")} resume={t("continueRoad")} className="mt-8" />
    </section>
  );
}
