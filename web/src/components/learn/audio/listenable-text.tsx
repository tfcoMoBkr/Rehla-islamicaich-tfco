"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";

import { splitSentences, useReadAloud } from "@/lib/audio/speech";
import { cn } from "@/lib/utils";

import { ListenControls } from "./listen-controls";

type ListenableTextProps = {
  text: string;
  className?: string;
  /** Where the controls sit; the text keeps its own styling. */
  controlsClassName?: string;
};

/**
 * Text with a Listen button in the page language, highlighting the sentence being read.
 * Only for text a synthetic voice may read: never Quran text or a hadith's Arabic text.
 */
export function ListenableText({ text, className, controlsClassName }: ListenableTextProps) {
  const locale = useLocale();
  const sentences = useMemo(() => splitSentences(text), [text]);
  const reader = useReadAloud(sentences, locale);

  return (
    <>
      <p className={className}>
        {sentences.map((sentence, index) => (
          <span
            key={`${index}-${sentence}`}
            className={cn("rounded-sm transition-colors duration-300", reader.current === index && "bg-dawn/25")}
          >
            {sentence}{" "}
          </span>
        ))}
      </p>
      <ListenControls reader={reader} className={controlsClassName} />
    </>
  );
}
