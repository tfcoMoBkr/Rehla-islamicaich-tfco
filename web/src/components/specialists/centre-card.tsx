import { Globe, Mail, MapPin, Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import type { ReferralCentre } from "@/lib/content/schema";
import { phoneParts, shown } from "@/lib/referral/centres";
import { cn } from "@/lib/utils";

/**
 * One referral body, exactly as the directory gives it: name, neighbourhood, tap-to-call numbers,
 * website, email, map and the languages it serves when listed. A field the directory does not give
 * is simply not shown; on English pages an Arabic-only name is shown in Arabic.
 */
export function CentreCard({ centre, compact = false }: { centre: ReferralCentre; compact?: boolean }) {
  const t = useTranslations("Specialist");
  const locale = useLocale();
  const name = shown(centre.name, locale);
  const city = shown(centre.city, locale);
  const languages = centre.languages && (locale === "en" && centre.languages.en ? { list: centre.languages.en, lang: "en" } : { list: centre.languages.ar, lang: "ar" });

  return (
    <article className={cn("grid gap-3 rounded-2xl border border-hairline bg-paper", compact ? "p-4" : "p-5 sm:p-6")} data-centre={centre.id}>
      <div className="grid gap-1">
        <h3 lang={name.lang} dir={name.lang === "ar" ? "rtl" : undefined} className={cn("font-semibold", compact ? "text-base" : "font-display text-lg")}>
          {name.text}
        </h3>
        <p className="text-sm text-muted-foreground">
          {centre.type === "nationalChannel" ? (
            t("nationalNote")
          ) : (
            <>
              <span lang={city.lang} dir={city.lang === "ar" ? "rtl" : undefined}>
                {city.text}
              </span>
              {centre.neighbourhood && (
                <>
                  {" · "}
                  {t("neighbourhood")}{" "}
                  <span lang="ar" dir="rtl">
                    {centre.neighbourhood}
                  </span>
                </>
              )}
            </>
          )}
        </p>
        {!compact && centre.address && (
          <p className="text-sm text-muted-foreground">
            {t("address")}:{" "}
            <span lang="ar" dir="rtl">
              {centre.address}
            </span>
          </p>
        )}
        {languages && (
          <p className="text-sm text-muted-foreground">
            {t("languages")}:{" "}
            <span lang={languages.lang} dir={languages.lang === "ar" ? "rtl" : undefined}>{new Intl.ListFormat(languages.lang).format(languages.list)}</span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {centre.phone &&
          phoneParts(centre.phone)
            .filter((part) => part.kind === "number")
            .map((part) => (
              <a key={part.href} href={part.href} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline bg-card px-4 font-semibold hover:bg-accent">
                <Phone aria-hidden className="size-4" />
                <span dir="ltr">{part.text}</span>
                <span className="sr-only">{t("call")}</span>
              </a>
            ))}
        {centre.website && (
          <a href={centre.website} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline bg-card px-4 hover:bg-accent">
            <Globe aria-hidden className="size-4" />
            {t("website")}
          </a>
        )}
        {centre.email && (
          <a href={`mailto:${centre.email}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline bg-card px-4 hover:bg-accent">
            <Mail aria-hidden className="size-4" />
            {t("email")}
          </a>
        )}
        {centre.mapUrl && (
          <a href={centre.mapUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline bg-card px-4 hover:bg-accent">
            <MapPin aria-hidden className="size-4" />
            {t("map")}
          </a>
        )}
      </div>
      {centre.phoneAlt && (
        <p className="text-sm text-muted-foreground">
          {t("otherNumbers")}:{" "}
          <span lang="ar" dir="rtl">
            {phoneParts(centre.phoneAlt).map((part, index) =>
              part.kind === "number" ? (
                <a key={index} href={part.href} dir="ltr" className="font-semibold underline underline-offset-4">
                  {part.text}
                </a>
              ) : (
                <span key={index}>{part.text}</span>
              ),
            )}
          </span>
        </p>
      )}
    </article>
  );
}
