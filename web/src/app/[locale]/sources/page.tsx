import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { resolveLocale } from "@/i18n/locale";
import { PageMessages } from "@/i18n/client-messages";
import { RafiqFigure } from "@/components/rafiq/rafiq-figure";
import { lessonMedia, loadArtManifest, loadKhutuwat, loadRafiqManifest, loadSources } from "@/lib/content/load";
import type { Media, RafiqManifest } from "@/lib/content/schema";
import type { SourceType } from "@/lib/content/schema";
import { cn } from "@/lib/utils";

// Rendered at build time: a request-time API here fails the build instead of making the page
// dynamic (and slow to open). See scripts/check-static.mjs.
export const dynamic = "error";

const GROUP_ORDER: readonly SourceType[] = [
  "quran",
  "hadith",
  "lessons",
  "video",
  "terminology",
  "referral",
  "illustrations",
  "retrieval",
  "reference",
];

export async function generateMetadata({ params }: PageProps<"/[locale]/sources">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Sources" });
  return { title: t("title"), description: t("description") };
}

/** Every source the product uses, from content/sources.json (the file docs/SOURCES.md is generated from). */
export default async function SourcesPage({ params }: PageProps<"/[locale]/sources">) {
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  const [tr, format, sources, khutuwat, art, rafiq] = await Promise.all([
    getTranslations("Sources"),
    getFormatter(),
    loadSources(),
    loadKhutuwat(),
    loadArtManifest(),
    loadRafiqManifest(),
  ]);
  const t = (text: { ar: string; en: string }) => text[locale];

  // Every image and video in the lessons a learner can open, each listed once with where it is used.
  const media = new Map<string, { item: Media; lessons: string[] }>();
  for (const lesson of khutuwat.lessons.values()) {
    for (const item of lessonMedia(lesson)) {
      const key = item.type === "image" ? item.src : item.youtubeId;
      const entry = media.get(key) ?? { item, lessons: [] };
      if (!entry.lessons.includes(t(lesson.title))) entry.lessons.push(t(lesson.title));
      media.set(key, entry);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pt-20 pb-32 sm:px-6 md:pt-24">
      <SectionHeading as="h1" title={tr("title")} description={tr("description")} />
      <p role="note" className="mt-6 rounded-xl border border-hairline border-s-4 border-s-oasis bg-paper px-5 py-4 leading-relaxed">
        {tr("lessonText")}
      </p>
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
                    <h3 className="text-xl leading-snug font-semibold">
                      {source.url ? (
                        <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 underline-offset-4 hover:underline">
                          {t(source.name)}
                          <ExternalLink aria-hidden className="size-4" />
                        </a>
                      ) : (
                        t(source.name)
                      )}
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
                  {source.type === "illustrations" && <ArtGallery items={art.items} rafiq={rafiq} />}
                </Card>
              ))}
            </section>
          );
        })}
        <section aria-labelledby="sources-media" className="grid gap-4">
          <h2 id="sources-media" className="font-display text-2xl font-semibold">
            {tr("mediaTitle")}
          </h2>
          {media.size === 0 ? (
            <p className="text-muted-foreground">{tr("mediaEmpty")}</p>
          ) : (
            <ul className="grid gap-3">
              {[...media.values()].map(({ item, lessons }) => (
                <li key={item.type === "image" ? item.src : item.youtubeId}>
                  <Card className="gap-2 px-6 sm:px-8">
                    <p className="font-medium">{t(item.alt)}</p>
                    <p className="text-sm text-muted-foreground">
                      {tr(item.type === "image" ? "mediaImage" : "mediaVideo")} · {item.credit} · {item.licence} ·{" "}
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                        {tr("mediaSource")}
                      </a>
                    </p>
                    <p className="text-sm text-muted-foreground">{tr("mediaUsedIn", { lessons: new Intl.ListFormat(locale).format(lessons) })}</p>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/** The team's art, shown as it is: Rafiq's poses with their credit, the scenes pinned on lesson boards, the icons. */
async function ArtGallery({ items, rafiq }: { items: readonly { file: string; description: string }[]; rafiq: RafiqManifest }) {
  const tr = await getTranslations("Sources");
  const groups = [
    { key: "scenes", title: tr("artScenes"), tile: "aspect-[40/26] w-full" },
    { key: "icons", title: tr("artIcons"), tile: "size-12" },
  ] as const;

  return (
    <PageMessages page="sources">
      <div className="grid gap-5">
        <section aria-label={tr("artRafiq")} className="grid gap-3">
          <h4 className="font-medium">
            {tr("artRafiq")} <span className="text-muted-foreground">· {tr("artCount", { count: rafiq.poses.length })}</span>
          </h4>
          <p className="text-sm text-muted-foreground">
            {tr("artCredit")}: <span lang="en">{rafiq.credit}</span> · <span lang="en">{rafiq.licence}</span>
          </p>
          <ul className="flex flex-wrap items-end gap-3">
            {rafiq.poses.map(({ pose }) => (
              <li key={pose} className="rounded-lg bg-night px-2 pt-2">
                <RafiqFigure pose={pose} height={pose === "hello" ? 120 : 96} />
              </li>
            ))}
          </ul>
        </section>
        {groups.map((group) => {
          const files = items.filter((item) => item.file.startsWith(`${group.key}/`));
          if (files.length === 0) return null;
          return (
            <section key={group.key} aria-label={group.title} className="grid gap-3">
              <h4 className="font-medium">
                {group.title} <span className="text-muted-foreground">· {tr("artCount", { count: files.length })}</span>
              </h4>
              <ul className={group.key === "scenes" ? "grid grid-cols-2 gap-3 sm:grid-cols-4" : "flex flex-wrap gap-2"}>
                {files.map((item) => (
                  <li key={item.file} className="overflow-hidden rounded-lg border border-border bg-paper">
                    {/* eslint-disable-next-line @next/next/no-img-element -- static SVG drawings, nothing for the image optimiser to do */}
                    <img src={`/art/${item.file}`} alt={item.description} lang="en" loading="lazy" className={group.tile} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </PageMessages>
  );
}
