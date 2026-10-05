"use client";

import { BookHeart } from "lucide-react";
import { useTranslations } from "next-intl";

import { useRafiqReaction } from "@/components/learn/board/rafiq-context";
import { DragHandle } from "@/components/learn/interactions/drag-handle";
import { optionClassName } from "@/components/learn/interactions/option-styles";
import { useDragDrop } from "@/components/learn/interactions/use-drag-drop";
import { useAccount } from "@/lib/account/session";
import { progressActions, useProgress } from "@/lib/learn/progress-store";
import type { ActivityView } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type ReflectionActivityProps = {
  activity: Extract<ActivityView, { type: "reflection" }>;
  lessonId: string;
  onChoose?: () => void;
};

/**
 * The learner keeps one card in their journal: tap it, or drag it into the journal. Stored on this
 * device, and in the learner's account if they are signed in.
 */
export function ReflectionActivity({ activity, lessonId, onChoose }: ReflectionActivityProps) {
  const t = useTranslations("Activity");
  const chosen = useProgress().picks[lessonId];
  const signedIn = useAccount() !== null;
  const react = useRafiqReaction();
  const { itemProps, targetProps } = useDragDrop((itemId) => choose(itemId));
  const kept = activity.items.find((item) => item.id === chosen);

  function choose(itemId: string) {
    progressActions.pick(lessonId, itemId);
    react("pleased");
    onChoose?.();
  }

  return (
    <fieldset className="grid gap-3">
      <legend className="sr-only">{activity.title}</legend>
      <div
        {...targetProps("journal")}
        className="grid gap-2 rounded-xl border-2 border-dashed border-dawn/60 p-3 transition-colors data-drop-over:border-primary data-drop-over:bg-primary/10"
      >
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookHeart aria-hidden className="size-4 text-success" />
          {kept ? t(signedIn ? "savedToJournalAccount" : "savedToJournal") : t("journalZone")}
        </p>
        {kept && <p className="animate-rise-in leading-relaxed font-medium">{kept.text}</p>}
      </div>
      {activity.items.map((item) => (
        <label
          key={item.id}
          {...itemProps(item.id)}
          className={cn(
            optionClassName,
            "cursor-pointer items-start leading-relaxed has-checked:border-dawn has-checked:bg-dawn/10 has-focus-visible:outline-2 has-focus-visible:outline-ring data-dragging:shadow-lg",
          )}
        >
          <DragHandle />
          <input
            type="radio"
            name={`${lessonId}-reflection`}
            checked={chosen === item.id}
            onChange={() => choose(item.id)}
            className="mt-1 size-5 shrink-0 accent-primary focus-visible:outline-none"
          />
          {item.text}
        </label>
      ))}
      <p className="text-sm text-muted-foreground">{t("deviceOnly")}</p>
    </fieldset>
  );
}
