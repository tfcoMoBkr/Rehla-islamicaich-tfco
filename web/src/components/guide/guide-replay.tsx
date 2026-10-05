"use client";

import { useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { replayGuide } from "@/lib/guide-store";

/** "How Rehla works": the tour again from its first step, on the learn page where it lives. */
export function GuideReplay({ className }: { className?: string }) {
  const t = useTranslations("Guide");
  const pathname = usePathname();
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        replayGuide();
        if (pathname !== "/learn") router.push("/learn");
      }}
    >
      {t("replay")}
    </button>
  );
}
