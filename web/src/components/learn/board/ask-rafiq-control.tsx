"use client";

import { useTranslations } from "next-intl";

import { Lantern } from "@/components/journey/lantern";
import { cn } from "@/lib/utils";

/** "Need this explained? Ask Rafiq": one plain, large control for what is on the board. */
export function AskRafiqControl({ onOpen, className }: { onOpen: () => void; className?: string }) {
  const t = useTranslations("LineHelp");
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className={cn(
        "inline-flex min-h-12 items-center gap-2.5 rounded-full border-2 border-dawn/70 bg-dawn/10 ps-3 pe-5 py-2 text-start font-semibold transition-colors hover:bg-dawn/20",
        className,
      )}
    >
      <Lantern className="size-7 shrink-0 text-current" />
      {t("askAbout")}
    </button>
  );
}
