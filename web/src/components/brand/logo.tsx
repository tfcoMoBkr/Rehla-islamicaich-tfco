import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { LogoMark } from "./logo-mark";

/** The wordmark: the name in the reader's script, with the other script beneath it. */
export function Logo({ className }: { className?: string }) {
  const t = useTranslations("Brand");
  const altLang = useLocale() === "ar" ? "en" : "ar";

  return (
    <Link
      href="/"
      aria-label={t("homeLabel")}
      className={cn("flex min-h-11 items-center gap-2.5 rounded-lg", className)}
    >
      <LogoMark className="size-9 shrink-0" />
      <span className="flex flex-col">
        <span className="font-display text-2xl leading-none font-bold">{t("name")}</span>
        <span
          lang={altLang}
          className="mt-1 text-[0.6875rem] leading-none font-medium text-muted-foreground [&:lang(en)]:tracking-[0.24em] [&:lang(en)]:uppercase"
        >
          {t("altName")}
        </span>
      </span>
    </Link>
  );
}
