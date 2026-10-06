"use client";

import { ListChecks, MessagesSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { ItemView, SituationView } from "@/lib/mawqif/types";

import { ConversationTest } from "./conversation-test";
import { MawqifTest, type TestQuestion, type TestSituation } from "./mawqif-test";

/** The final test, taken as short conversations or as quick written questions. */
export function TestChooser({
  group,
  views,
  questions,
  situations,
  items,
}: {
  group: string;
  views: readonly SituationView[];
  questions: readonly TestQuestion[];
  situations: readonly TestSituation[];
  items: readonly ItemView[];
}) {
  const t = useTranslations("Mawqif");
  const [mode, setMode] = useState<"conversations" | "questions" | null>(null);

  if (mode === "conversations") return <ConversationTest group={group} views={views} onUnavailable={() => setMode("questions")} />;
  if (mode === "questions") return <MawqifTest group={group} questions={questions} situations={situations} items={items} />;
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-2 font-semibold">{t("testModeLabel")}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => setMode("conversations")} className={CHOICE}>
          <MessagesSquare aria-hidden className="size-7 text-terracotta-text" />
          <span className="text-lg font-semibold">{t("conversationTest")}</span>
          <span className="text-sm text-muted-foreground">{t("conversationTestIntro", { count: Math.min(views.length, 4) })}</span>
        </button>
        <button type="button" onClick={() => setMode("questions")} className={CHOICE}>
          <ListChecks aria-hidden className="size-7 text-oasis-text" />
          <span className="text-lg font-semibold">{t("quickTest")}</span>
          <span className="text-sm text-muted-foreground">{t("testIntro", { count: questions.length })}</span>
        </button>
      </div>
    </fieldset>
  );
}

const CHOICE =
  "grid content-start gap-2 rounded-2xl border-2 border-hairline bg-paper p-5 text-start transition-colors hover:border-dawn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
