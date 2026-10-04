import { Footprints } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { StationMarker } from "@/components/journey/station";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { resolveLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { requireFeature } from "@/lib/require-feature";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/learn">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "Learn" });

  return { title: t("title"), description: t("description") };
}

// Checkpoint 0 only: an honest "in preparation" state until lessons land in checkpoint 1.
export default async function LearnPage({ params }: PageProps<"/[locale]/learn">) {
  requireFeature("learn");
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  const [t, tCommon] = await Promise.all([
    getTranslations("Learn"),
    getTranslations("Common"),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 pt-20 pb-32 sm:px-6 md:pt-24">
      <SectionHeading as="h1" title={t("title")} description={t("description")} />

      <Card className="mt-10 flex-row items-start gap-5 px-6 sm:px-8">
        <StationMarker className="shrink-0">
          <Footprints />
        </StationMarker>
        <div>
          <h2 className="font-display text-xl font-semibold">{t("status.title")}</h2>
          <p className="mt-1 text-muted-foreground">{t("status.body")}</p>
        </div>
      </Card>

      <Button asChild variant="outline" className="mt-8">
        <Link href="/">{tCommon("backHome")}</Link>
      </Button>
    </div>
  );
}
