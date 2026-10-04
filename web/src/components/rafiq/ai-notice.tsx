import { useTranslations } from "next-intl";

import { Lantern, type LanternState } from "@/components/journey/lantern";
import { cn } from "@/lib/utils";

type AiNoticeProps = {
  /** Mirrors Rafiq's state so the lantern glows while an answer is being prepared. */
  state?: LanternState;
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
      <Lantern state={state} className="size-10 shrink-0 text-ink" />
      <p className="pt-0.5">
        <strong className="font-semibold text-foreground">{t("title")}</strong>{" "}
        <span className="text-muted-foreground">{t("body")}</span>
      </p>
    </div>
  );
}
