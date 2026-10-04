import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

type ScoreSummaryProps = {
  correct: number;
  total: number;
  /** Shown under the numbers, e.g. whether the next station is now open. */
  note?: string;
  className?: string;
};

export function ScoreSummary({ correct, total, note, className }: ScoreSummaryProps) {
  const t = useTranslations("Assessment");

  return (
    <div className={cn("rounded-2xl border border-hairline bg-paper p-6", className)}>
      <p className="text-sm font-medium text-muted-foreground">{t("score")}</p>
      <p className="mt-1 font-display text-4xl font-semibold">
        {t("scoreValue", { correct, total })}
      </p>
      <div className="mt-4 flex gap-1" aria-hidden>
        {Array.from({ length: total }, (_, index) => (
          <span key={index} className={cn("h-2 flex-1 rounded-full", index < correct ? "bg-oasis" : "bg-hairline")} />
        ))}
      </div>
      {note && <p className="mt-4 text-muted-foreground">{note}</p>}
    </div>
  );
}
