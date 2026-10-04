import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/** The six-part lesson anatomy. "Explain it to Rafiq" joins once Rafiq is enabled. */
export type LessonPart = "recap" | "ideas" | "activity" | "situation" | "close";

/** Where the learner is in the lesson, as stops on a short road. */
export function PartStepper({ parts, current }: { parts: readonly LessonPart[]; current: LessonPart }) {
  const t = useTranslations("Lesson");
  const position = parts.indexOf(current);

  return (
    <div className="flex items-center gap-3">
      <p className="text-sm font-medium">
        <span className="sr-only">{t("partOf", { current: position + 1, total: parts.length })}: </span>
        {t(`parts.${current}`)}
      </p>
      <ol aria-hidden className="flex items-center">
        {parts.map((part, index) => (
          <li key={part} className="flex items-center">
            {index > 0 && <span className={cn("h-0.5 w-3", index <= position ? "bg-dawn" : "bg-hairline")} />}
            <span
              className={cn(
                "size-2.5 rounded-full border-2",
                index < position && "border-dawn bg-dawn",
                index === position && "size-3.5 border-terracotta-text bg-paper",
                index > position && "border-hairline bg-paper",
              )}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
