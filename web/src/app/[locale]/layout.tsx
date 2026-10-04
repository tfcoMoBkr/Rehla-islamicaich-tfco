import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/layout/skip-link";
import { DirectionProvider } from "@/components/ui/direction";
import { localeDirection, resolveLocale } from "@/i18n/locale";
import { routing } from "@/i18n/routing";
import { fontVariables } from "@/lib/fonts";

import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: { default: t("title"), template: t("titleTemplate") },
    description: t("description"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  const dir = localeDirection[locale];

  return (
    <html lang={locale} dir={dir} className={fontVariables}>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
          <DirectionProvider dir={dir}>
            <SkipLink />
            <SiteHeader />
            <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 outline-none">
              {children}
            </main>
            <SiteFooter />
          </DirectionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
