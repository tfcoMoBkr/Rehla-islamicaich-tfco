"use client";

import { Backpack } from "lucide-react";
import { useTranslations } from "next-intl";

import { useProgress } from "@/lib/learn/progress-store";
import { provisionsOf } from "@/lib/learn/progress";
import { cn } from "@/lib/utils";

/** The provisions gathered in Practice, as a small bag beside the heading. */
export function ProvisionsBadge({ className }: { className?: string }) {
  const t = useTranslations("Practice");
  const count = provisionsOf(useProgress());
  return (
    <p className={cn("inline-flex min-h-10 items-center gap-2 rounded-full border border-dawn/60 bg-dawn/12 px-4 font-semibold", className)}>
      <Backpack aria-hidden className="size-5 text-terracotta-text" />
      {t("provisions", { count })}
    </p>
  );
}
