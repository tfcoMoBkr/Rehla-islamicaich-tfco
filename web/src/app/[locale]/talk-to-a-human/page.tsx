import { ExternalLink, Globe, Mail, Phone, ShieldCheck, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Lantern } from "@/components/journey/lantern";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { resolveLocale } from "@/i18n/locale";
import { loadReferralCentres } from "@/lib/content/load";

export async function generateMetadata({ params }: PageProps<"/[locale]/talk-to-a-human">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Human" });
  return { title: t("title"), description: t("description") };
}

/** Qualified people to turn to, from content/referral-centers.json. Only verified contacts are listed. */
export default async function TalkToAHumanPage({ params }: PageProps<"/[locale]/talk-to-a-human">) {
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  const [t, format, centres] = await Promise.all([getTranslations("Human"), getFormatter(), loadReferralCentres()]);
  const languageName = new Intl.DisplayNames([locale], { type: "language" });

  return (
    <div className="mx-auto max-w-3xl px-4 pt-20 pb-32 sm:px-6 md:pt-24">
      <SectionHeading as="h1" title={t("title")} description={t("description")} />

      <div role="note" className="mt-8 flex items-start gap-3 rounded-2xl border border-hairline border-s-4 border-s-dawn bg-paper p-5">
        <Lantern className="size-10 shrink-0 text-ink" />
        <p>{t("whyHuman")}</p>
      </div>

      {centres.length === 0 ? (
        <Card className="mt-8 gap-3 px-6 sm:px-8">
          <UsersRound aria-hidden className="size-7 text-oasis-text" />
          <h2 className="font-display text-xl font-semibold">{t("emptyTitle")}</h2>
          <p className="text-muted-foreground">{t("emptyBody")}</p>
          <p className="text-muted-foreground">{t("emptyMeanwhile")}</p>
        </Card>
      ) : (
        <ul className="mt-8 grid gap-4">
          {centres.map((centre) => (
            <li key={centre.id}>
              <Card className="gap-4 px-6 sm:px-8">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="font-display text-xl font-semibold">{centre.name[locale]}</h2>
                  <span className="rounded-full bg-oasis/10 px-2.5 py-0.5 text-xs font-semibold text-oasis-text">
                    {t(`kind.${centre.kind}`)}
                  </span>
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
                  <dt className="font-medium">{t("languages")}</dt>
                  <dd className="text-muted-foreground">
                    {new Intl.ListFormat(locale).format(centre.languages.map((code) => languageName.of(code) ?? code))}
                  </dd>
                  {(centre.city || centre.address) && (
                    <>
                      <dt className="font-medium">{t("where")}</dt>
                      <dd className="text-muted-foreground">
                        {[centre.address?.[locale], centre.city?.[locale]].filter(Boolean).join(" · ")}
                      </dd>
                    </>
                  )}
                  {centre.hours && (
                    <>
                      <dt className="font-medium">{t("hours")}</dt>
                      <dd className="text-muted-foreground">{centre.hours[locale]}</dd>
                    </>
                  )}
                </dl>
                {centre.notes && <p className="text-muted-foreground">{centre.notes[locale]}</p>}
                <div className="flex flex-wrap gap-2">
                  {centre.phone && (
                    <Button asChild variant="outline">
                      <a href={`tel:${centre.phone.replace(/[^\d+]/g, "")}`}>
                        <Phone aria-hidden />
                        <span dir="ltr">{centre.phone}</span>
                      </a>
                    </Button>
                  )}
                  {centre.email && (
                    <Button asChild variant="outline">
                      <a href={`mailto:${centre.email}`}>
                        <Mail aria-hidden />
                        {t("email")}
                      </a>
                    </Button>
                  )}
                  {centre.url && (
                    <Button asChild variant="outline">
                      <a href={centre.url} target="_blank" rel="noreferrer">
                        <Globe aria-hidden />
                        {t("website")}
                      </a>
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("verified", { date: format.dateTime(new Date(centre.verifiedOn), { dateStyle: "long" }) })}{" "}
                  <a href={centre.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
                    {t("checkedAt")}
                    <ExternalLink aria-hidden className="size-3" />
                  </a>
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 flex items-start gap-2 text-sm text-muted-foreground">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-oasis-text" />
        {t("privacy")}
      </p>
    </div>
  );
}
