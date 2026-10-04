import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { RafiqFigure } from "./rafiq-figure";

type AiNoticeProps = {
  /** Rafiq thinks while an answer is being prepared, and listens otherwise. */
  state?: "idle" | "thinking";
  className?: string;
};

// Shown wherever Rafiq answers. It has no dismiss control by design: the disclosure must stay visible.
export function AiNotice({ state = "idle", className }: AiNoticeProps) {
  const t = useTranslations("AiNotice");

  return (
    <div
      role="note"
      aria-label={t("label")}
      className={cn(
        "tone-day flex items-start gap-3 rounded-xl border border-hairline border-s-4 border-s-dawn bg-paper p-4 text-sm",
        className,
      )}
    >
      <RafiqFigure pose={state === "thinking" ? "thinking" : "listening"} height={64} decorative className="shrink-0 rtl:-scale-x-100" />
      <p className="pt-0.5">
        <strong className="font-semibold text-foreground">{t("title")}</strong>{" "}
        <span className="text-muted-foreground">{t("body")}</span>
      </p>
    </div>
  );
}
