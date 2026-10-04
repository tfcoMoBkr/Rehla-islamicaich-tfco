import { useTranslations } from "next-intl";

import type { LessonSource } from "@/lib/learn/types";

/** "Source: …" under a statement, linking to the part of the source it comes from. */
export function SourceLinks({ sources }: { sources: readonly LessonSource[] }) {
  const t = useTranslations("Lesson");
  if (sources.length === 0) return null;

  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
      <span>{t("cardSource")}</span>
      {sources.map((source) => (
        <a key={source.key} href={source.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
          {source.title}
        </a>
      ))}
    </p>
  );
}
