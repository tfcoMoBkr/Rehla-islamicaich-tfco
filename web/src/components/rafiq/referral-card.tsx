import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { ReferralReason } from "@/lib/rafiq/answer";
import { inLanguage, type AnswerLanguage } from "@/lib/rafiq/languages";
import { cn } from "@/lib/utils";

type ReferralCardProps = {
  reason: Exclude<ReferralReason, "smalltalk">;
  links: readonly string[];
  /** The card's words in the answer's language, when that is not the page's. */
  own?: { title: string; body: string; language: AnswerLanguage };
};

/** Rafiq hands over to a person, and says why. */
export function ReferralCard({ reason, links, own }: ReferralCardProps) {
  const t = useTranslations("Rafiq");
  const voice = own ? inLanguage(own.language) : null;

  return (
    <div role="note" className="grid gap-2 rounded-2xl border border-terracotta/30 border-s-4 border-s-terracotta bg-terracotta/6 p-4">
      <div lang={voice?.lang} dir={voice?.dir} className={cn("grid gap-2", voice?.className)}>
        <p className="font-semibold">{own?.title ?? t(`referral.${reason}.title`)}</p>
        <p className="leading-relaxed">{own?.body ?? t(`referral.${reason}.body`)}</p>
      </div>
      {links.includes("/talk-to-a-specialist") && (
        <Link href="/talk-to-a-specialist" className="justify-self-start font-semibold text-terracotta-text underline underline-offset-4">
          {t("talkToSpecialist")}
        </Link>
      )}
    </div>
  );
}
