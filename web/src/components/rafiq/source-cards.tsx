import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { SourceCard } from "@/lib/rafiq/answer";

/** The numbered sources that close every answer; each [n] marker jumps to its card. */
export function SourceCards({ sources, id }: { sources: readonly SourceCard[]; id: string }) {
  const t = useTranslations("Rafiq");
  const headingId = `${id}-sources`;

  return (
    <section aria-labelledby={headingId} className="grid gap-3">
      <h3 id={headingId} className="font-display text-lg font-semibold">
        {t("sourcesTitle")}
      </h3>
      <ol className="grid gap-2.5">
        {sources.map((source) => (
          <li
            key={source.n}
            id={`${id}-source-${source.n}`}
            tabIndex={-1}
            className="flex scroll-mt-24 gap-3 rounded-xl border border-hairline bg-card p-3.5 outline-none target:border-dawn target:ring-2 target:ring-dawn/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-dawn/20 text-sm font-semibold">
              {source.n}
            </span>
            <div className="grid min-w-0 gap-1">
              <p className="font-semibold">
                <span className="sr-only">{t("sourceMarker", { n: source.n })}: </span>
                <span dir="auto">{source.title}</span>
              </p>
              {source.reference && (
                <p dir="auto" className="text-sm text-muted-foreground">
                  {source.reference}
                </p>
              )}
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 underline underline-offset-4">
                  {t("openSource", { publisher: source.publisher })}
                  <ExternalLink aria-hidden className="size-3.5" />
                </a>
                <Link href={`/sources#${source.sourceId}`} className="underline underline-offset-4">
                  {t("aboutSource")}
                </Link>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
