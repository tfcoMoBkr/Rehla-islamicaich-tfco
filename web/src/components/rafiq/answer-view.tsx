import { useTranslations } from "next-intl";

import { Lantern } from "@/components/journey/lantern";
import { SpecialistCard } from "@/components/specialists/specialist-card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ANSWER_FONT_VARIABLES } from "@/lib/answer-fonts";
import { SPECIALIST_REASONS, splitMarkers, type AnswerBlock, type RafiqAnswer } from "@/lib/rafiq/answer";
import { answerMessages } from "@/lib/rafiq/answer-messages";
import { inLanguage, type AnswerLanguage } from "@/lib/rafiq/languages";
import { fillName, useLearnerName, withoutName } from "@/lib/rafiq/name";
import { cn } from "@/lib/utils";

import { BookBlockView, FixedNote, HadithBlockView, Marker, QuranBlockView, TermBlockView } from "./answer-blocks";
import { ReferralCard } from "./referral-card";
import { SourceCards } from "./source-cards";

export type LessonLink = { title: string; href: `/${string}` };

type AnswerViewProps = {
  answer: RafiqAnswer;
  /** Unique per answer on the page: markers jump to `#{id}-source-{n}`. */
  id: string;
  /** Lessons by id, to name the lesson that covers a later topic. */
  lessons?: Readonly<Record<string, LessonLink>>;
  /** Asks a follow-up as the learner's next turn: the quick actions under an answer. */
  onFollowUp?: (question: string) => void;
};

const QUICK_ACTIONS = ["simpler", "more", "now"] as const;
/** Referrals about the learner's own case open with reassurance when Rafiq wrote none. */
const REASSURED = new Set(["personalCase", "fatwa"]);

/**
 * One reply from Rafiq, in the language it was asked in. Around the cited part he speaks warmly (an
 * opening and a follow-up the service checked to carry no religious statement; fixed lines from the
 * reviewed message file in Urdu, Bengali and French). The cited part shows his words with [n]
 * markers, verses and hadiths exactly as their sources publish them, and the numbered sources. A
 * referral says why he hands over, and the specialist card shows who can help. Every reply that
 * carries religious content ends with the disclosure that he is an AI tool.
 */
export function AnswerView({ answer, id, lessons, onFollowUp }: AnswerViewProps) {
  const t = useTranslations("Rafiq");
  const later = answer.laterLessonId ? lessons?.[answer.laterLessonId] : undefined;
  const topics = (answer.topicLessonIds ?? []).flatMap((lessonId) => (lessons?.[lessonId] ? [lessons[lessonId]] : []));
  const own = answerMessages(answer.language);
  const voice = inLanguage(answer.language);
  const fonts = ANSWER_FONT_VARIABLES[answer.language];
  const name = useLearnerName();
  // Warm lines may address the learner by name: filled in here, on the device, or removed cleanly.
  const say = (text: string, className?: string) => (
    <p {...voice} className={cn("text-lg", voice.className, className)}>
      {fillName(text, name)}
    </p>
  );

  if (answer.kind === "chat") {
    return (
      <div className={cn("grid gap-3", fonts)}>
        {say(answer.opening ?? own?.smalltalk ?? t("smalltalk"))}
        {answer.followUp && say(answer.followUp, "text-muted-foreground")}
      </div>
    );
  }
  if (answer.kind === "clarify") {
    return <div className={fonts}>{say(answer.opening ?? own?.clarify ?? t("clarifyFallback"))}</div>;
  }

  const referral = answer.referral;
  const cited = answer.blocks.length > 0;
  const reassure = !own && referral && REASSURED.has(referral.reason) ? t("reassure") : null;
  const opening = answer.opening ?? (cited ? own?.opening : reassure);
  const followUp = answer.followUp ?? (cited ? own?.followUp : null);
  return (
    <div className={cn("grid gap-5", fonts)}>
      {answer.languageFallback && <p className="text-sm text-muted-foreground">{t("languageFallback")}</p>}
      {opening && say(opening)}
      {cited && (
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
      {referral && SPECIALIST_REASONS.has(referral.reason) && (
        <SpecialistCard ids={referral.centers.length > 0 ? referral.centers : undefined} outside={referral.region === "outside"} />
      )}
      {topics.length > 0 && (
        <div className="rounded-xl border border-oasis/30 bg-oasis/6 px-4 py-3">
          <p className="font-semibold">{t("topicTitle")}</p>
          <ul className="mt-1 grid gap-1">
            {topics.map((lesson) => (
              <li key={lesson.href}>
                <Link href={lesson.href} className="font-semibold underline underline-offset-4">
                  {lesson.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
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
      {answer.encouragement && say(answer.encouragement)}
      {followUp && say(followUp, "text-muted-foreground")}
      {onFollowUp && answer.kind === "answer" && cited && (
        <div role="group" aria-label={t("actionsLabel")} className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Button key={action} type="button" variant="outline" size="sm" onClick={() => onFollowUp(t(`actions.${action}`))}>
              {t(`actions.${action}`)}
            </Button>
          ))}
        </div>
      )}
      {answer.kind !== "danger" && (
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
      )}
    </div>
  );
}

function Block({ block, id, language }: { block: AnswerBlock; id: string; language: AnswerLanguage }) {
  if (block.type === "quran") return <QuranBlockView block={block} id={id} language={language} />;
  if (block.type === "hadith") return <HadithBlockView block={block} id={id} language={language} />;
  if (block.type === "term") return <TermBlockView block={block} id={id} />;
  if (block.type === "book") return <BookBlockView block={block} id={id} language={language} />;
  if (block.type === "note") return <FixedNote note={block.note} />;
  // The cited answer never carries the name; a stray placeholder is removed, never shown.
  return <TextBlock text={withoutName(block.text)} role={block.role} id={id} language={language} />;
}

// A bullet, or a number in ASCII, Arabic-Indic, Persian or Bengali digits, then a space.
const LIST_ITEM = /^\s*(?:[-*•▪◦]|[0-9\u0660-\u0669\u06f0-\u06f9\u09e6-\u09ef]+[.)-])\s+/;

/**
 * Rafiq's own words: paragraphs, and lists where he wrote one item per line. The direct answer and
 * the explanation after the sources are each labelled as generated, set apart from the verses and
 * hadiths quoted as their publishers print them.
 */
function TextBlock({ text, role, id, language }: { text: string; role: "answer" | "explanation"; id: string; language: AnswerLanguage }) {
  const t = useTranslations("Rafiq");
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
    <section className="grid gap-3 rounded-xl border border-dashed border-hairline px-4 py-3">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground">
        {role === "explanation" ? t("generatedExplanation") : t("generatedAnswer")}
      </p>
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
    </section>
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
