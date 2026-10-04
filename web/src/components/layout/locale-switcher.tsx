"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const targets = routing.locales.filter((target) => target !== locale);

  return (
    <div className={cn("flex items-center", className)}>
      {targets.map((target) => (
        <Link
          key={target}
          href={pathname}
          locale={target}
          hrefLang={target}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium transition-colors hover:border-muted-foreground hover:bg-accent"
        >
          <Languages aria-hidden className="size-4 text-dawn" />
          <span className="sr-only">{t("label")}: </span>
          <span lang={target}>{t("locale", { locale: target })}</span>
        </Link>
      ))}
    </div>
  );
}
