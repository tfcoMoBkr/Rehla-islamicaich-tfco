import { useTranslations } from "next-intl";

import { Lantern } from "@/components/journey/lantern";
import { Link } from "@/i18n/navigation";
import { ANSWER_FONT_VARIABLES } from "@/lib/answer-fonts";
import { splitMarkers, type AnswerBlock, type RafiqAnswer } from "@/lib/rafiq/answer";
import { answerMessages } from "@/lib/rafiq/answer-messages";
import { inLanguage, type AnswerLanguage } from "@/lib/rafiq/languages";
import { cn } from "@/lib/utils";

import { HadithBlockView, Marker, QuranBlockView } from "./answer-blocks";
import { ReferralCard } from "./referral-card";
import { SourceCards } from "./source-cards";

export type LessonLink = { title: string; href: `/${string}` };

type AnswerViewProps = {
  answer: RafiqAnswer;
  /** Unique per answer on the page: markers jump to `#{id}-source-{n}`. */
  id: string;
  /** Lessons by id, to name the lesson that covers a later topic. */
  lessons?: Readonly<Record<string, LessonLink>>;
};

/**
 * One answer from Rafiq, in the language it was asked in: his words with [n] markers, verses and
 * hadiths exactly as their sources publish them, the numbered sources, a referral when he hands
 * over to a person, and the disclosure that he is an AI tool. Interface labels stay in the page's
 * language; what Rafiq says is in the answer's.
 */
export function AnswerView({ answer, id, lessons }: AnswerViewProps) {
  const t = useTranslations("Rafiq");
  const later = answer.laterLessonId ? lessons?.[answer.laterLessonId] : undefined;
  const own = answerMessages(answer.language);
  const voice = inLanguage(answer.language);
  const fonts = ANSWER_FONT_VARIABLES[answer.language];

  if (answer.referral?.reason === "smalltalk") {
    return (
      <p {...voice} className={cn("text-lg", voice.className, fonts)}>
        {own?.smalltalk ?? t("smalltalk")}
      </p>
    );
  }

  const referral = answer.referral;
  return (
    <div className={cn("grid gap-5", fonts)}>
      {answer.languageFallback && <p className="text-sm text-muted-foreground">{t("languageFallback")}</p>}
      {answer.blocks.length > 0 && (
        <div lang={voice.lang} dir={voice.dir} className="grid gap-4">
          {answer.blocks.map((block, index) => (
            <Block key={index} block={block} id={id} language={answer.language} />
          ))}
        </div>
      )}
      {referral && referral.reason !== "smalltalk" && (
        <ReferralCard
          reason={referral.reason}
          links={referral.links}
          own={own ? { ...own.referral[referral.reason], language: answer.language } : undefined}
        />
      )}
      {later && (
        <p className="rounded-xl border border-oasis/30 bg-oasis/6 px-4 py-3">
          <span className="block font-semibold">{t("laterTitle")}</span>
          {t.rich("laterBody", {
            lesson: () => (
              <Link href={later.href} className="font-semibold underline underline-offset-4">
                {later.title}
              </Link>
            ),
          })}
        </p>
      )}
      {answer.sources.length > 0 && <SourceCards sources={answer.sources} id={id} />}
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lantern className="size-5 shrink-0 text-ink" />
        {own ? (
          <span lang={voice.lang} dir={voice.dir}>
            {own.disclosure}
          </span>
        ) : (
          t("disclosure")
        )}
      </p>
    </div>
  );
}

function Block({ block, id, language }: { block: AnswerBlock; id: string; language: AnswerLanguage }) {
  if (block.type === "quran") return <QuranBlockView block={block} id={id} language={language} />;
  if (block.type === "hadith") return <HadithBlockView block={block} id={id} language={language} />;
  return <TextBlock text={block.text} id={id} language={language} />;
}

// A bullet, or a number in ASCII, Arabic-Indic, Persian or Bengali digits, then a space.
const LIST_ITEM = /^\s*(?:[-*•▪◦]|[0-9\u0660-\u0669\u06f0-\u06f9\u09e6-\u09ef]+[.)-])\s+/;

/** Rafiq's own words: paragraphs, and lists where he wrote one item per line. */
function TextBlock({ text, id, language }: { text: string; id: string; language: AnswerLanguage }) {
  const { className } = inLanguage(language);
  const groups: { list: boolean; numbered: boolean; lines: string[] }[] = [];
  for (const line of text.split(/\n+/).filter((part) => part.trim())) {
    const item = LIST_ITEM.exec(line);
    const last = groups.at(-1);
    if (item && last?.list) last.lines.push(line.slice(item[0].length));
    else if (item) groups.push({ list: true, numbered: /\d/.test(item[0]), lines: [line.slice(item[0].length)] });
    else groups.push({ list: false, numbered: false, lines: [line] });
  }
  return (
    <>
      {groups.map((group, index) => {
        if (!group.list) {
          return (
            <p key={index} className={cn("text-lg", className)}>
              <MarkedText text={group.lines[0]} id={id} />
            </p>
          );
        }
        const List = group.numbered ? "ol" : "ul";
        return (
          <List key={index} className={cn("grid gap-1.5 ps-6 text-lg", group.numbered ? "list-decimal" : "list-disc", className)}>
            {group.lines.map((line, item) => (
              <li key={item}>
                <MarkedText text={line} id={id} />
              </li>
            ))}
          </List>
        );
      })}
    </>
  );
}

function MarkedText({ text, id }: { text: string; id: string }) {
  const parts = splitMarkers(text);
  return parts.map((part, index) => {
    if (part.kind === "marker") return <Marker key={index} n={part.n} id={id} />;
    // A marker sits against the word it sources, as a footnote number does.
    return parts[index + 1]?.kind === "marker" ? part.text.trimEnd() : part.text;
  });
}
