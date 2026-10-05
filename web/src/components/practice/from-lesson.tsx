import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

const SLOT = "\u0000";

/** "From the lesson: …", with the lesson's name as the link to it. */
export function FromLesson({ number, title, href }: { number: string; title: string; href: `/${string}` }) {
  const t = useTranslations("Practice");
  const [before, after] = t("fromLesson", { lesson: SLOT }).split(SLOT);
  return (
    <p className="text-sm text-muted-foreground">
      {before}
      <Link href={href} className="font-medium text-foreground underline underline-offset-4">
        {number} · {title}
      </Link>
      {after}
    </p>
  );
}
