import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { LessonView } from "@/lib/learn/types";

/** The books the lesson quotes and its video source, under its title, each linked to the sources page. */
export function SourceLine({ lesson }: { lesson: LessonView }) {
  const t = useTranslations("Lesson");

  if (lesson.demo) {
    return <p className="text-sm text-muted-foreground">{t("demoSource")}</p>;
  }

  return (
    <dl className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-3">
      <dt className="font-medium text-foreground">{t("textSource")}</dt>
      <dd className="grid gap-0.5">
        {lesson.sources.length === 0 && <span>{t("textSourceTeam")}</span>}
        {lesson.sources.map((source) => (
          <span key={source.key}>
            <a href={source.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
              {source.title}
            </a>
            {source.sourceId && (
              <Link href={`/sources#${source.sourceId}`} className="ms-2 text-xs underline underline-offset-4">
                {t("aboutSource")}
              </Link>
            )}
          </span>
        ))}
      </dd>
      {lesson.video && (
        <>
          <dt className="font-medium text-foreground">{t("videoSource")}</dt>
          <dd>
            <Link href={`/sources#${lesson.video.id}`} className="underline underline-offset-4">
              {lesson.video.name}
            </Link>
          </dd>
        </>
      )}
    </dl>
  );
}
