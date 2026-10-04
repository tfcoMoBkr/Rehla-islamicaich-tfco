import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

const badgeClassName =
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5";

/** Every lesson carries this while `reviewed` is false. Unreviewed lessons never reach production. */
export function AwaitingReviewBadge({ className }: { className?: string }) {
  const t = useTranslations("Learning");
  return (
    <span className={cn(badgeClassName, "border-terracotta-text/40 bg-terracotta/10 text-terracotta-text", className)}>
      {t("awaitingReview")}
    </span>
  );
}

/** Marks neutral demonstration content that is not religious material. */
export function DemoBadge({ className }: { className?: string }) {
  const t = useTranslations("Learning");
  return (
    <span className={cn(badgeClassName, "border-oasis-text/40 bg-oasis/10 text-oasis-text", className)}>
      {t("demoBadge")}
    </span>
  );
}
