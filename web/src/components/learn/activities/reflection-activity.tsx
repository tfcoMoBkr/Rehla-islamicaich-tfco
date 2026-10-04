"use client";

import { BookHeart } from "lucide-react";
import { useTranslations } from "next-intl";

import { optionClassName } from "@/components/learn/interactions/option-styles";
import { progressActions, useProgress } from "@/lib/learn/progress-store";
import type { ActivityView } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

type ReflectionActivityProps = {
  activity: Extract<ActivityView, { type: "reflection" }>;
  lessonId: string;
  onChoose?: () => void;
};

/** The learner keeps one card in their journal. Stored on this device only, never sent anywhere. */
export function ReflectionActivity({ activity, lessonId, onChoose }: ReflectionActivityProps) {
  const t = useTranslations("Activity");
  const chosen = useProgress().picks[lessonId];

  return (
    <fieldset className="grid gap-3">
      <legend className="sr-only">{activity.title}</legend>
      {activity.items.map((item) => (
        <label
          key={item.id}
          className={cn(
            optionClassName,
            "cursor-pointer items-start leading-relaxed has-checked:border-dawn has-checked:bg-dawn/10 has-focus-visible:outline-2 has-focus-visible:outline-ring",
          )}
        >
          <input
            type="radio"
            name={`${lessonId}-reflection`}
            checked={chosen === item.id}
            onChange={() => {
              progressActions.pick(lessonId, item.id);
              onChoose?.();
            }}
            className="mt-1 size-5 shrink-0 accent-primary focus-visible:outline-none"
          />
          {item.text}
        </label>
      ))}
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <BookHeart aria-hidden className="size-4 text-success" />
        {chosen ? t("savedToJournal") : t("deviceOnly")}
      </p>
    </fieldset>
  );
}
