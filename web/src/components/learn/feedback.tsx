import { CircleCheck, Footprints } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FeedbackProps = {
  /** `retry` is never a penalty: it invites another try and shows where the answer lies. */
  tone: "right" | "retry";
  children: ReactNode;
  /** The lesson sentence the answer comes from. */
  quote?: string | null;
  className?: string;
};

export function Feedback({ tone, children, quote, className }: FeedbackProps) {
  const t = useTranslations("Learning");
  const Icon = tone === "right" ? CircleCheck : Footprints;

  return (
    <div
      role="status"
      className={cn(
        "rounded-xl border p-4",
        tone === "right" ? "border-oasis/40 bg-oasis/8" : "border-dawn/50 bg-dawn/10",
        className,
      )}
    >
      <p className="flex items-center gap-2 font-semibold">
        <Icon aria-hidden className={cn("size-5", tone === "right" ? "text-oasis-text" : "text-terracotta-text")} />
        {children}
      </p>
      {quote && (
        <figure className="mt-2">
          <figcaption className="text-sm text-muted-foreground">{t("fromTheLesson")}</figcaption>
          <blockquote className="mt-1 border-s-2 border-dawn ps-3">{quote}</blockquote>
        </figure>
      )}
    </div>
  );
}
