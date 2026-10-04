import { CircleCheck, Footprints } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import type { QuestionView } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

function CorrectAnswer({ question }: { question: QuestionView }) {
  const t = useTranslations("Question");
  const list = new Intl.ListFormat(useLocale(), { type: "conjunction" });

  switch (question.type) {
    case "single":
      return <p>{question.options.find((option) => option.id === question.answer)?.text}</p>;
    case "multiple":
      return (
        <ul className="list-inside list-disc">
          {question.options
            .filter((option) => question.answers.includes(option.id))
            .map((option) => (
              <li key={option.id}>{option.text}</li>
            ))}
        </ul>
      );
    case "trueFalse":
      return <p>{question.answer ? t("true") : t("false")}</p>;
    case "order":
      return (
        <ol className="list-inside list-decimal">
          {question.items.map((item) => (
            <li key={item.id}>{item.text}</li>
          ))}
        </ol>
      );
    case "match":
      return (
        <ul className="grid gap-1">
          {question.pairs.map((pair) => (
            <li key={pair.id}>
              {pair.left} — {pair.right}
            </li>
          ))}
        </ul>
      );
    case "sort":
      return (
        <ul className="grid gap-1">
          {question.groups.map((group) => (
            <li key={group.id}>
              <span className="font-semibold">{group.label}: </span>
              {list.format(question.items.filter((item) => item.group === group.id).map((item) => item.text))}
            </li>
          ))}
        </ul>
      );
  }
}

type ReviewListProps = {
  questions: readonly QuestionView[];
  answers: Record<string, boolean>;
};

/** Every question, with how it went, the right answer and the lesson sentence behind it. */
export function ReviewList({ questions, answers }: ReviewListProps) {
  const t = useTranslations("Assessment");

  return (
    <ol className="grid gap-4">
      {questions.map((question, index) => {
        const right = answers[question.id] === true;
        const Icon = right ? CircleCheck : Footprints;
        return (
          <li key={question.id} className="rounded-xl border border-border bg-card p-5">
            <p className="flex items-start gap-2 font-semibold">
              <span className="text-muted-foreground">{index + 1}.</span>
              {question.prompt}
            </p>
            <p
              className={cn(
                "mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium",
                right ? "bg-success/10 text-success" : "bg-dawn/15 text-destructive",
              )}
            >
              <Icon aria-hidden className="size-4" />
              {right ? t("rightFirstTime") : t("notThisTime")}
            </p>
            <div className="mt-3 text-sm">
              <p className="font-medium text-muted-foreground">{t("answer")}</p>
              <div className="mt-1">
                <CorrectAnswer question={question} />
              </div>
            </div>
            <figure className="mt-3 text-sm">
              <figcaption className="font-medium text-muted-foreground">{t("fromTheLesson")}</figcaption>
              <blockquote className="mt-1 border-s-2 border-dawn ps-3">{question.sourceQuote}</blockquote>
            </figure>
          </li>
        );
      })}
    </ol>
  );
}
