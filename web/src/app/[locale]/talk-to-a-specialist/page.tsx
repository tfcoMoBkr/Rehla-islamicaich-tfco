import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Lantern } from "@/components/journey/lantern";
import { CentreCard } from "@/components/specialists/centre-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { Link } from "@/i18n/navigation";
import { PageMessages } from "@/i18n/client-messages";
import { resolveLocale } from "@/i18n/locale";
import { loadReferralCentres, loadSources } from "@/lib/content/load";
import { citiesOf, nationalChannels, shown } from "@/lib/referral/centres";

// Rendered at build time: a request-time API here fails the build instead of making the page
// dynamic (and slow to open). See scripts/check-static.mjs.
export const dynamic = "error";

export async function generateMetadata({ params }: PageProps<"/[locale]/talk-to-a-specialist">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Specialist" });
  return { title: t("title"), description: t("description") };
}

/** Licensed bodies a learner can turn to, from content/referral-centers.json: the national channel first, then by city. */
export default async function TalkToASpecialistPage({ params }: PageProps<"/[locale]/talk-to-a-specialist">) {
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  const [t, format, directory, sources] = await Promise.all([
    getTranslations("Specialist"),
    getFormatter(),
    loadReferralCentres(),
    loadSources(),
  ]);
  const source = sources.find((candidate) => candidate.id === directory.source);
  const associations = directory.centers.filter((centre) => centre.type === "association");

  return (
    <PageMessages page="specialists">
      <div className="mx-auto max-w-3xl px-4 pt-20 pb-32 sm:px-6 md:pt-24">
        <SectionHeading as="h1" title={t("title")} description={t("description")} />

        <div role="note" className="mt-8 flex items-start gap-3 rounded-2xl border border-hairline border-s-4 border-s-dawn bg-paper p-5">
          <Lantern className="size-10 shrink-0 text-ink" />
          <p>{t("why")}</p>
        </div>

        <section aria-labelledby="specialists-national" className="mt-10 grid gap-4">
          <h2 id="specialists-national" className="font-display text-2xl font-semibold">
            {t("nationalTitle")}
          </h2>
          {nationalChannels(directory.centers).map((centre) => (
            <CentreCard key={centre.id} centre={centre} />
          ))}
        </section>

        {citiesOf(directory.centers).map((city) => {
          const label = shown(city, locale);
          const id = `city-${city.en ?? city.ar}`.replace(/\s+/g, "-");
          return (
            <section key={city.ar} aria-labelledby={id} className="mt-10 grid gap-4">
              <h2 id={id} lang={label.lang} className="font-display text-2xl font-semibold">
                {label.text}
              </h2>
              {associations
                .filter((centre) => centre.city.ar === city.ar)
                .map((centre) => (
                  <CentreCard key={centre.id} centre={centre} />
                ))}
            </section>
          );
        })}

        <p className="mt-10 rounded-xl border border-hairline bg-paper px-4 py-3">{t("outside")}</p>

        <p className="mt-6 text-sm text-muted-foreground">
          {t("source", {
            name: source ? source.name[locale] : directory.source,
            date: format.dateTime(new Date(directory.verifiedOn), { dateStyle: "long" }),
          })}{" "}
          <Link href={`/sources#${directory.source}`} className="underline underline-offset-4">
            {t("aboutSource")}
          </Link>
        </p>

        <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-oasis-text" />
          {t("privacy")}
        </p>
      </div>
    </PageMessages>
  );
}
