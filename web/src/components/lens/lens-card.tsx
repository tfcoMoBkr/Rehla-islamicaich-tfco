import { BookX, Camera, Clock, EyeOff, FileLock2, ScanSearch, ShieldAlert, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { LensCard as Card } from "@/lib/lens/lens";

const ICONS: Record<Card, LucideIcon> = {
  person: EyeOff,
  unclear: ScanSearch,
  privacy: FileLock2,
  unsafe: ShieldAlert,
  unmatched: BookX,
  nothing: Camera,
  timeout: Clock,
};

/**
 * When Lens does not answer: a calm card that says why, in plain words, and offers one next step.
 * It is a designed state, not an error.
 */
export function LensCard({ card, subject, onRetake }: { card: Card; subject?: string; onRetake: () => void }) {
  const t = useTranslations("Lens");
  const Icon = ICONS[card];
  let action: ReactNode = (
    <Button onClick={onRetake}>
      <Camera aria-hidden />
      {card === "timeout" ? t("tryAgain") : t("retake")}
    </Button>
  );
  if (card === "unmatched") {
    action = (
      <Button asChild>
        <Link href="/talk-to-a-specialist">{t("specialistLink")}</Link>
      </Button>
    );
  }
  return (
    <section aria-labelledby="lens-card-title" className="grid gap-4 rounded-3xl border border-hairline bg-paper p-6 sm:p-8">
      <span className="grid size-12 place-items-center rounded-2xl bg-dawn/15 text-terracotta-text">
        <Icon aria-hidden className="size-6" />
      </span>
      <h2 id="lens-card-title" tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
        {card === "nothing" && subject ? t("cards.nothing.titleWith", { subject }) : t(`cards.${card}.title`)}
      </h2>
      <p className="leading-relaxed text-muted-foreground">{t(`cards.${card}.body`)}</p>
      <div className="flex flex-wrap gap-3">{action}</div>
    </section>
  );
}
