import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { VideoView } from "@/lib/learn/types";

/**
 * The lesson's suggested video: its publisher's page is the primary link, and the file plays from
 * the publisher's own servers. Nothing loads until the learner presses play.
 */
export function VideoCard({ video, title }: { video: VideoView; title: string }) {
  const t = useTranslations("Lesson");

  return (
    <section aria-label={title} className="grid gap-3 rounded-2xl border border-hairline bg-paper p-5">
      <div className="grid gap-1">
        <h3 className="font-display text-xl font-semibold">{title}</h3>
        <a
          href={video.page}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 justify-self-start font-semibold underline underline-offset-4"
        >
          {t("videoPage")}
          <ExternalLink aria-hidden className="size-4" />
        </a>
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <div className="flex gap-1.5">
            <dt>{t("videoPublisher")}</dt>
            <dd>
              <Link href={`/sources#${video.id}`} className="underline underline-offset-4">
                {video.name}
              </Link>
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt>{t("videoLanguageLabel")}</dt>
            <dd>{t("videoLanguageName")}</dd>
          </div>
        </dl>
      </div>
      <video controls preload="none" src={video.file} className="aspect-video w-full rounded-xl bg-night" aria-label={title}>
        <a href={video.page}>{t("videoPage")}</a>
      </video>
      <p className="text-xs text-muted-foreground">{t("videoPrivacy")}</p>
    </section>
  );
}
