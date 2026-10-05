import { Camera, Languages, MessageCircleQuestion } from "lucide-react";
import { useTranslations } from "next-intl";

import { AnswerView, type LessonLink } from "@/components/rafiq/answer-view";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { TEXT_ROWS, type LensResponse } from "@/lib/lens/lens";

const ASKED_TEXT_LENGTH = 300;

/** The question "Ask «رفيق» more about this" opens Rafiq with: about the text read, or the subject. */
export function followUpQuestion(response: LensResponse, t: ReturnType<typeof useTranslations<"Lens">>): string | null {
  // A verse or hadith is asked about by its reference: its words are never re-typed.
  const block = response.answer?.blocks.find((candidate) => candidate.type !== "text");
  if (block?.type === "quran") return t("askAboutVerse", { surah: block.surahName ?? String(block.surah), ayah: block.ayah });
  if (block?.type === "hadith") return t("askAboutHadith", { title: block.title });
  const text = response.seen?.visibleText?.text.trim();
  if (text) return t("askAboutText", { text: text.slice(0, ASKED_TEXT_LENGTH) });
  const subject = response.seen?.subject.trim();
  return subject ? t("askAboutSubject", { subject }) : null;
}

/**
 * What Lens found: what this is (the subject, the text read, a labelled machine translation of
 * ordinary text), then what it means (Rafiq's cited answer, or the boundary of the row that applied).
 */
export function LensResult({
  response,
  lessons,
  onRetake,
  onChoose,
}: {
  response: LensResponse;
  lessons?: Readonly<Record<string, LessonLink>>;
  onRetake: () => void;
  onChoose: (subject: string) => void;
}) {
  const t = useTranslations("Lens");
  const { seen, row, answer, others } = response;
  const question = followUpQuestion(response, t);
  const translation = TEXT_ROWS.has(row) ? seen?.plainTranslation : null;

  return (
    <div className="grid gap-8">
      <section aria-labelledby="lens-what" className="grid gap-4 rounded-3xl border border-hairline bg-paper p-6 sm:p-8">
        <h2 id="lens-what" tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
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
        <section aria-labelledby="lens-meaning" className="grid gap-4">
          <h2 id="lens-meaning" className="font-display text-2xl font-semibold">
            {t("whatItMeans")}
          </h2>
          <AnswerView answer={answer} id="lens" lessons={lessons} />
        </section>
      )}

      {others.length > 0 && (
        <section aria-labelledby="lens-others" className="grid gap-3">
          <h2 id="lens-others" className="font-semibold">
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

      <div className="flex flex-wrap gap-3">
        {question && (
          <Button asChild>
            <Link href={{ pathname: "/rafiq", query: { ask: question } }}>
              <MessageCircleQuestion aria-hidden />
              {row === 15 ? t("askAbout") : t("askMore")}
            </Link>
          </Button>
        )}
        <Button variant="outline" onClick={onRetake}>
          <Camera aria-hidden />
          {t("anotherPhoto")}
        </Button>
      </div>

      {!answer && <p className="text-sm text-muted-foreground">{t("disclosure")}</p>}
    </div>
  );
}
