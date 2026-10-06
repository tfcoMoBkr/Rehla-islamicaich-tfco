import { Languages } from "lucide-react";
import { useTranslations } from "next-intl";

import { AnswerView, type LessonLink } from "@/components/rafiq/answer-view";
import { Link } from "@/i18n/navigation";
import { TEXT_ROWS, type LensResponse } from "@/lib/lens/lens";

/**
 * Rafiq's first message about a photo: what this is (the subject, the text read, a labelled machine
 * translation of ordinary text), then what it means (his cited answer, or the boundary of the row
 * that applied). The conversation about the photo goes on below it.
 */
export function LensResult({
  response,
  lessons,
  onChoose,
  id,
}: {
  /** Unique per photo in the conversation. */
  id: string;
  response: LensResponse;
  lessons?: Readonly<Record<string, LessonLink>>;
  onChoose: (subject: string) => void;
}) {
  const t = useTranslations("Lens");
  const { seen, row, answer, others } = response;
  const translation = TEXT_ROWS.has(row) ? seen?.plainTranslation : null;

  return (
    <div className="grid gap-8">
      <section aria-labelledby={`${id}-what`} className="grid gap-4 rounded-3xl border border-hairline bg-paper p-6 sm:p-8">
        <h2 id={`${id}-what`} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
          {t("whatThisIs")}
        </h2>
        {seen?.subject && (
          <p className="text-xl font-semibold">{row === 16 ? t("otherReligion", { subject: seen.subject }) : seen.subject}</p>
        )}
        {seen?.visibleText && (
          <div className="grid gap-1">
            <p className="text-sm font-semibold text-muted-foreground">{t("textRead")}</p>
            <p dir="auto" lang={seen.visibleText.language || undefined} className="rounded-xl bg-sand px-4 py-3 text-lg leading-relaxed whitespace-pre-line">
              {seen.visibleText.text}
            </p>
          </div>
        )}
        {translation && (
          <div className="grid gap-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <Languages aria-hidden className="size-4" />
              {t("machineTranslation")}
            </p>
            <p dir="auto" className="rounded-xl border border-dashed border-hairline px-4 py-3 text-lg leading-relaxed">
              {translation}
            </p>
          </div>
        )}
        {response.description && (
          <div className="grid gap-1">
            <p className="text-sm font-semibold text-muted-foreground">{t("generalDescription")}</p>
            <p dir="auto" className="text-lg leading-relaxed">
              {response.description}
            </p>
          </div>
        )}
        {row === 11 && <p className="rounded-xl border border-dawn/50 bg-dawn/8 px-4 py-3">{t("unmatchedNote")}</p>}
        {row === 13 && (
          <p className="rounded-xl border border-dawn/50 bg-dawn/8 px-4 py-3">
            {t("productNote")}{" "}
            <Link href="/talk-to-a-specialist" className="font-semibold underline underline-offset-4">
              {t("specialistLink")}
            </Link>
          </p>
        )}
        {row === 15 && <p className="rounded-xl border border-dawn/50 bg-dawn/8 px-4 py-3">{t("claimNote")}</p>}
      </section>

      {answer && (
        <section aria-labelledby={`${id}-meaning`} className="grid gap-4">
          <h2 id={`${id}-meaning`} className="font-display text-2xl font-semibold">
            {t("whatItMeans")}
          </h2>
          <AnswerView answer={answer} id={id} lessons={lessons} />
        </section>
      )}

      {others.length > 0 && (
        <section aria-labelledby={`${id}-others`} className="grid gap-3">
          <h2 id={`${id}-others`} className="font-semibold">
            {t("alsoInPhoto")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {others.map((other) => (
              <li key={other}>
                <button
                  type="button"
                  onClick={() => onChoose(other)}
                  className="min-h-11 rounded-full border-2 border-hairline bg-paper px-4 font-medium transition-colors hover:border-dawn focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {other}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!answer && <p className="text-sm text-muted-foreground">{t("disclosure")}</p>}
    </div>
  );
}
