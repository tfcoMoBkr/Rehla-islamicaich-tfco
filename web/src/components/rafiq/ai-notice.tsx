import { useTranslations } from "next-intl";

import { Lantern } from "@/components/journey/lantern";
import { cn } from "@/lib/utils";

import { RafiqFigure } from "./rafiq-figure";

type AiNoticeProps = {
  /** Rafiq thinks while an answer is being prepared, and listens otherwise. */
  state?: "idle" | "thinking";
  /** Where Rafiq already stands nearby, the notice shows his lantern instead of his figure. */
  figure?: boolean;
  className?: string;
};

// Shown wherever Rafiq answers. It has no dismiss control by design: the disclosure must stay visible.
export function AiNotice({ state = "idle", figure = true, className }: AiNoticeProps) {
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
      {figure ? (
        <RafiqFigure pose={state === "thinking" ? "thinking" : "listening"} height={64} decorative className="shrink-0 rtl:-scale-x-100" />
      ) : (
        <Lantern state={state} className="size-8 shrink-0 text-ink" />
      )}
      <p className="pt-0.5">
        <strong className="font-semibold text-foreground">{t("title")}</strong>{" "}
        <span className="text-muted-foreground">{t("body")}</span>
      </p>
    </div>
  );
}
