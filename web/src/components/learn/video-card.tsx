import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { VideoView } from "@/lib/learn/types";

import { YouTubeEmbed } from "./youtube-embed";

/** The lesson's suggested video, played inside the lesson, naming its channel and language. */
export function VideoCard({ video, title }: { video: VideoView; title: string }) {
  const t = useTranslations("Lesson");

  return (
    <section aria-label={title} className="grid gap-3 rounded-2xl border border-hairline bg-paper p-5">
      <div>
        <h3 className="font-display text-xl font-semibold">{title}</h3>
        <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <div className="flex gap-1.5">
            <dt>{t("videoChannel")}</dt>
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
      <YouTubeEmbed title={title} youtubeId={video.youtubeId} playlistId={video.playlistId} />
      <p className="text-xs text-muted-foreground">{t("videoPrivacy")}</p>
    </section>
  );
}
