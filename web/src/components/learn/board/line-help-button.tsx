"use client";

import { CircleHelp } from "lucide-react";
import { useTranslations } from "next-intl";

/** "I didn't understand": a small mark at the end of a board line that opens the help panel. */
export function LineHelpButton({ onOpen }: { onOpen: () => void }) {
  const t = useTranslations("LineHelp");

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={t("open")}
      title={t("open")}
      className="animate-fade-in -my-1.5 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
    >
      <CircleHelp aria-hidden className="size-5" />
    </button>
  );
}
