"use client";

import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import type { VideoView } from "@/lib/learn/types";

function embedUrl(video: VideoView): string {
  const base = "https://www.youtube-nocookie.com/embed";
  return video.playlistId
    ? `${base}/videoseries?list=${video.playlistId}&autoplay=1&rel=0`
    : `${base}/${video.youtubeId}?autoplay=1&rel=0`;
}

/**
 * A suggested video from an approved channel. Nothing is requested from YouTube until the
 * learner presses play, and then only through its privacy-enhanced domain.
 */
export function VideoCard({ video, title }: { video: VideoView; title: string }) {
  const t = useTranslations("Lesson");
  const [playing, setPlaying] = useState(false);

  return (
    <section aria-label={title} className="grid gap-3 rounded-2xl border border-hairline bg-paper p-5">
      <div>
        <h3 className="font-display text-xl font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("videoFrom")}{" "}
          <Link href={`/sources#${video.id}`} className="underline underline-offset-4">
            {video.name}
          </Link>{" "}
          · {t("videoLanguage")}
        </p>
      </div>
      <div className="aspect-video overflow-hidden rounded-xl bg-night">
        {playing ? (
          <iframe
            src={embedUrl(video)}
            title={title}
            className="size-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="tone-night grid size-full place-items-center gap-2 text-sand"
          >
            <span className="grid size-16 place-items-center rounded-full bg-dawn text-night">
              <Play aria-hidden className="size-7 translate-x-0.5" />
            </span>
            <span className="font-medium">{t("playVideo")}</span>
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("videoPrivacy")}</p>
    </section>
  );
}
