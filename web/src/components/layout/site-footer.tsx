import { useTranslations } from "next-intl";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";

import { AiServiceStatus, AiServiceStatusFallback } from "./ai-service-status";
import { DuneEdge } from "./dune-edge";

export function SiteFooter() {
  const t = useTranslations("Footer");

  return (
    <footer className="tone-night relative bg-background">
      <DuneEdge className="absolute inset-x-0 bottom-full h-6 sm:h-10" />
      <div className="mx-auto grid max-w-6xl gap-5 px-4 pt-8 pb-10 sm:px-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-10">
        <Logo />
        <p className="text-sm text-muted-foreground">{t("credit")}</p>
        <Suspense fallback={<AiServiceStatusFallback />}>
          <AiServiceStatus />
        </Suspense>
      </div>
    </footer>
  );
}
