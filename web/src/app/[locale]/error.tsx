"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("Error");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-2xl px-4 pt-28 pb-32 text-center sm:px-6">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">{t("title")}</h1>
      <p className="mt-4 text-lg text-muted-foreground">{t("body")}</p>
      <Button className="mt-8" onClick={retry}>
        {t("retry")}
      </Button>
    </div>
  );
}
