"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRafiqReaction } from "@/components/learn/board/rafiq-context";
import { Feedback } from "@/components/learn/feedback";
import { optionClassName } from "@/components/learn/interactions/option-styles";
import { Button } from "@/components/ui/button";
import type { QuestionView } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

export type ChoiceQuestionView = Extract<QuestionView, { type: "single" | "multiple" | "trueFalse" }>;

export function isChoiceCorrect(question: ChoiceQuestionView, selected: readonly string[]): boolean {
  switch (question.type) {
    case "single":
      return selected.length === 1 && selected[0] === question.answer;
    case "trueFalse":
      return selected.length === 1 && selected[0] === String(question.answer);
    case "multiple":
      return (
        selected.length === question.answers.length && question.answers.every((id) => selected.includes(id))
      );
  }
}

type ChoiceQuestionProps = {
  question: ChoiceQuestionView;
  /** `practice` checks right away and lets the learner try again; `assess` records and moves on. */
  mode: "practice" | "assess";
  onAnswered: (correctFirstTime: boolean) => void;
};

export function ChoiceQuestion({ question, mode, onAnswered }: ChoiceQuestionProps) {
  const t = useTranslations("Question");
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<"right" | "retry" | null>(null);
  const [firstTry, setFirstTry] = useState<boolean | null>(null);
  const react = useRafiqReaction();

  const options =
    question.type === "trueFalse"
      ? [
          { id: "true", text: t("true") },
          { id: "false", text: t("false") },
        ]
      : question.options;
  const multiple = question.type === "multiple";
  const locked = result === "right";

  function toggle(id: string) {
    setSelected((current) => {
      if (!multiple) return [id];
      return current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
    });
    if (result === "retry") setResult(null);
    react("thinking");
  }

  function submit() {
    const correct = isChoiceCorrect(question, selected);
    if (mode === "assess") {
      onAnswered(correct);
      return;
    }
    if (firstTry === null) setFirstTry(correct);
    setResult(correct ? "right" : "retry");
    react(correct ? "pleased" : "encouraging");
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (locked) onAnswered(firstTry ?? true);
        else submit();
      }}
    >
      <fieldset className="grid gap-3">
        <legend className="mb-3 text-xl leading-relaxed font-semibold">{question.prompt}</legend>
        {multiple && <p className="-mt-1 text-sm text-muted-foreground">{t("chooseAll")}</p>}
        {options.map((option) => {
          const checked = selected.includes(option.id);
          return (
            <label
              key={option.id}
              className={cn(
                optionClassName,
                "cursor-pointer has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:outline-2 has-focus-visible:outline-ring",
                locked && "cursor-default",
              )}
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                name={question.id}
                value={option.id}
                checked={checked}
                disabled={locked}
                onChange={() => toggle(option.id)}
                className="size-5 shrink-0 accent-primary focus-visible:outline-none"
              />
              {option.text}
            </label>
          );
        })}
      </fieldset>

      {result === "right" && <Feedback tone="right" quote={question.sourceQuote}>{t("right")}</Feedback>}
      {result === "retry" && <Feedback tone="retry" quote={question.sourceQuote}>{t("tryAgain")}</Feedback>}

      <Button type="submit" disabled={selected.length === 0} className="justify-self-start">
        {locked ? t("continue") : mode === "assess" ? t("next") : t("check")}
      </Button>
    </form>
  );
}
