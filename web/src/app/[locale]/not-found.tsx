import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");
  const tCommon = useTranslations("Common");

  return (
    <div className="mx-auto max-w-2xl px-4 pt-28 pb-32 text-center sm:px-6">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">{t("title")}</h1>
      <p className="mt-4 text-lg text-muted-foreground">{t("body")}</p>
      <Button asChild className="mt-8">
        <Link href="/">{tCommon("backHome")}</Link>
      </Button>
    </div>
  );
}
