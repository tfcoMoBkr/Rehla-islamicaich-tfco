import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { resolveLocale } from "@/i18n/locale";
import { loadSources } from "@/lib/content/load";
import type { SourceType } from "@/lib/content/schema";
import { cn } from "@/lib/utils";

const GROUP_ORDER: readonly SourceType[] = ["quran", "hadith", "lessons", "video", "terminology", "referral"];

export async function generateMetadata({ params }: PageProps<"/[locale]/sources">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Sources" });
  return { title: t("title"), description: t("description") };
}

/** Every source the product uses, from content/sources.json (the file docs/SOURCES.md is generated from). */
export default async function SourcesPage({ params }: PageProps<"/[locale]/sources">) {
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  const [tr, format, sources] = await Promise.all([getTranslations("Sources"), getFormatter(), loadSources()]);
  const t = (text: { ar: string; en: string }) => text[locale];

  return (
    <div className="mx-auto max-w-4xl px-4 pt-20 pb-32 sm:px-6 md:pt-24">
      <SectionHeading as="h1" title={tr("title")} description={tr("description")} />
      <div className="mt-12 grid gap-14">
        {GROUP_ORDER.map((type) => {
          const group = sources.filter((source) => source.type === type);
          if (group.length === 0) return null;
          return (
            <section key={type} aria-labelledby={`sources-${type}`} className="grid gap-4">
              <h2 id={`sources-${type}`} className="font-display text-2xl font-semibold">
                {tr(`groups.${type}`)}
              </h2>
              {group.map((source) => (
                <Card key={source.id} id={source.id} className="scroll-mt-24 gap-4 px-6 sm:px-8">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="font-display text-xl font-semibold">
                      <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 underline-offset-4 hover:underline">
                        {t(source.name)}
                        <ExternalLink aria-hidden className="size-4" />
                      </a>
                    </h3>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        source.status === "approved" ? "bg-oasis/10 text-oasis-text" : "bg-dawn/15 text-ink",
                      )}
                    >
                      {tr(`status.${source.status}`)}
                    </span>
                  </div>
                  <dl className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                    <dt className="font-medium">{tr("usedFor")}</dt>
                    <dd className="text-muted-foreground">{t(source.usedFor)}</dd>
                    <dt className="font-medium">{tr("licence")}</dt>
                    <dd className="text-muted-foreground">{t(source.licence)}</dd>
                    {source.alsoAt.length > 0 && (
                      <>
                        <dt className="font-medium">{tr("alsoAt")}</dt>
                        <dd className="grid gap-1">
                          {source.alsoAt.map((url) => (
                            <a key={url} href={url} target="_blank" rel="noreferrer" dir="ltr" className="justify-self-start break-all text-muted-foreground underline underline-offset-4">
                              {url}
                            </a>
                          ))}
                        </dd>
                      </>
                    )}
                    <dt className="font-medium">{tr("verifiedOn")}</dt>
                    <dd className="text-muted-foreground">
                      {format.dateTime(new Date(source.verifiedOn), { dateStyle: "long" })}
                    </dd>
                  </dl>
                </Card>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
