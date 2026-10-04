import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

export function BackToRoad() {
  const t = useTranslations("Learn");
  return (
    <Link
      href="/learn"
      className="inline-flex min-h-11 items-center gap-2 rounded-md font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowRight aria-hidden className="size-4 ltr:rotate-180" />
      {t("backToRoad")}
    </Link>
  );
}
