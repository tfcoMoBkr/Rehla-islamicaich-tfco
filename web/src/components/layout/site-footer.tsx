import { useTranslations } from "next-intl";

import { Logo } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";

import { GuideReplay } from "@/components/guide/guide-replay";

import { AiServiceStatus } from "./ai-service-status";
import { DuneEdge } from "./dune-edge";

export function SiteFooter() {
  const t = useTranslations("Footer");

  return (
    <footer className="tone-night relative bg-background">
      <DuneEdge className="absolute inset-x-0 bottom-full h-6 sm:h-10" />
      <div className="mx-auto grid max-w-6xl gap-5 px-4 pt-8 pb-10 sm:px-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-10">
        <Logo />
        <div className="grid gap-2 text-sm">
          <p className="text-muted-foreground">{t("credit")}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href="/talk-to-a-specialist" className="font-medium underline underline-offset-4 hover:text-dawn">
              {t("talkToSpecialist")}
            </Link>
            <Link href="/sources" className="font-medium underline underline-offset-4 hover:text-dawn">
              {t("sources")}
            </Link>
            <GuideReplay className="min-h-6 font-medium underline underline-offset-4 hover:text-dawn" />
          </div>
        </div>
        <AiServiceStatus />
      </div>
    </footer>
  );
}
