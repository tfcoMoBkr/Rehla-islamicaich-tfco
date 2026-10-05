import { useTranslations } from "next-intl";

import { DemoBadge } from "@/components/learn/content-badges";

/** Says plainly that a practice lesson is a demo with neutral content. */
export function LessonBanner() {
  const t = useTranslations("Lesson");
  return (
    <div role="note" className="mt-6 rounded-xl border border-oasis-text/30 bg-oasis/8 p-4">
      <DemoBadge />
      <p className="mt-2">{t("demoNotice")}</p>
    </div>
  );
}
