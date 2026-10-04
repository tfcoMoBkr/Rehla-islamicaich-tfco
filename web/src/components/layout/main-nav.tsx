"use client";

import { useTranslations } from "next-intl";

import { enabledSections } from "@/config/features";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function MainNav({ className }: { className?: string }) {
  const t = useTranslations("Navigation");
  const pathname = usePathname();

  if (enabledSections.length === 0) {
    return null;
  }

  return (
    <nav aria-label={t("label")} className={className}>
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
        {enabledSections.map(({ feature, href }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={feature} className="shrink-0">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative inline-flex min-h-11 items-center rounded-md px-3 font-medium text-muted-foreground transition-colors hover:text-foreground",
                  // The current section carries a small point of dawn light beneath it.
                  isActive &&
                    "text-foreground after:absolute after:inset-x-0 after:bottom-1 after:mx-auto after:size-1.5 after:rounded-full after:bg-dawn",
                )}
              >
                {t(`sections.${feature}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
