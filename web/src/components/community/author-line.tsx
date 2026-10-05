"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import { countryName } from "@/lib/account/countries";
import type { Author } from "@/lib/community/types";
import { cn } from "@/lib/utils";

export const formatDate = (iso: string, locale: string): string => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso));

/** A writer as others see them: community name, badge, and country only when they show it. */
export function AuthorLine({ author, createdAt, edited = false, className }: { author: Author | null; createdAt: string; edited?: boolean; className?: string }) {
  const t = useTranslations("Community");
  const locale = useLocale();
  const palestine = t("countryNames.PS");
  const fixed = useMemo(() => ({ PS: palestine }), [palestine]);
  const badge = author && author.role !== "member" ? t(`badges.${author.role}`) : null;

  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground", className)}>
      <span className="font-semibold text-foreground">{author?.name ?? t("formerMember")}</span>
      {badge && (
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", author?.role === "moderator" ? "bg-oasis/12 text-oasis-text" : "bg-dawn/15 text-foreground")}>
          {badge}
        </span>
      )}
      {author?.country && <span>{countryName(author.country, locale, fixed)}</span>}
      <span aria-hidden>·</span>
      <time dateTime={createdAt}>{formatDate(createdAt, locale)}</time>
      {edited && <span>({t("edited")})</span>}
    </p>
  );
}
