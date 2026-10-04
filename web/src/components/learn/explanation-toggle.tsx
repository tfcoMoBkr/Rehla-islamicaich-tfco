"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** A hadith's explanation, collapsed until the learner asks for it. */
export function ExplanationToggle({ children }: { children: ReactNode }) {
  const t = useTranslations("Lesson");
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <div className="grid gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="inline-flex min-h-11 items-center gap-2 justify-self-start rounded-full border border-oasis/40 bg-paper px-4 text-sm font-medium hover:border-oasis"
      >
        <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
        {open ? t("hideExplanation") : t("showExplanation")}
      </button>
      {open && (
        <div id={id} className="animate-rise-in grid gap-2 rounded-xl bg-paper/70 p-4 text-muted-foreground">
          {children}
        </div>
      )}
    </div>
  );
}
