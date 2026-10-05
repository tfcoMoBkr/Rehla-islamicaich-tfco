import { ArrowRight, BookMarked, ScrollText, ShieldCheck, UserRoundCheck, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

const TRUST: readonly { key: "verbatim" | "source" | "noRulings" | "specialists"; icon: LucideIcon }[] = [
  { key: "verbatim", icon: ScrollText },
  { key: "source", icon: BookMarked },
  { key: "noRulings", icon: ShieldCheck },
  { key: "specialists", icon: UserRoundCheck },
];

/** How the platform keeps its content trustworthy, in four lines, with every source one tap away. */
export async function TrustStop() {
  const t = await getTranslations("Home.trust");

  return (
    <section aria-labelledby="trust-title" className="px-4 pb-24 sm:px-6 md:pb-32">
      <div className="tone-night relative z-10 mx-auto max-w-6xl rounded-3xl bg-background px-5 py-8 sm:px-10">
        <h2 id="trust-title" className="font-display text-2xl font-semibold">
          {t("title")}
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map(({ key, icon: Icon }) => (
            <li key={key} className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-border text-dawn">
                <Icon aria-hidden className="size-5" />
              </span>
              <span className="pt-2 font-medium">{t(key)}</span>
            </li>
          ))}
        </ul>
        <Link href="/sources" className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-dawn underline underline-offset-4">
          {t("link")}
          <ArrowRight aria-hidden className="size-4 rtl:-scale-x-100" />
        </Link>
      </div>
    </section>
  );
}
