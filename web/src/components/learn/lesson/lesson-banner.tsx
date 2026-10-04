import { useTranslations } from "next-intl";

import { AwaitingReviewBadge, DemoBadge } from "@/components/learn/content-badges";
import type { LessonView } from "@/lib/learn/types";

/** Says plainly when a lesson is a demo or still awaiting review, with notes for reviewers. */
export function LessonBanner({ lesson, showDetails }: { lesson: LessonView; showDetails: boolean }) {
  const t = useTranslations("Lesson");

  if (lesson.demo) {
    return (
      <div role="note" className="mt-6 rounded-xl border border-oasis-text/30 bg-oasis/8 p-4">
        <DemoBadge />
        <p className="mt-2">{t("demoNotice")}</p>
      </div>
    );
  }

  if (lesson.reviewed) return null;

  return (
    <div role="note" className="mt-6 rounded-xl border border-terracotta-text/30 bg-terracotta/6 p-4">
      <AwaitingReviewBadge />
      <p className="mt-2">{t("draftNotice")}</p>
      {showDetails && lesson.reviewNotes.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer font-medium">{t("reviewNotesTitle", { count: lesson.reviewNotes.length })}</summary>
          <ul className="mt-2 grid list-inside list-disc gap-1 text-sm" lang="en" dir="ltr">
            {lesson.reviewNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </details>
      )}
      {showDetails && lesson.issues.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer font-medium">{t("issuesTitle", { count: lesson.issues.length })}</summary>
          <ul className="mt-2 grid gap-1 font-mono text-sm" dir="ltr">
            {lesson.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
