"use client";

import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

type YouTubeEmbedProps = {
  title: string;
  youtubeId?: string;
  playlistId?: string;
};

function embedUrl({ youtubeId, playlistId }: Omit<YouTubeEmbedProps, "title">): string {
  const base = "https://www.youtube-nocookie.com/embed";
  return playlistId ? `${base}/videoseries?list=${playlistId}&rel=0` : `${base}/${youtubeId}?rel=0`;
}

/**
 * A YouTube player in privacy-enhanced mode. Nothing is requested from YouTube until the learner
 * asks to see the video, and the video itself never starts on its own.
 */
export function YouTubeEmbed({ title, youtubeId, playlistId }: YouTubeEmbedProps) {
  const t = useTranslations("Lesson");
  const [shown, setShown] = useState(false);

  return (
    <div className="aspect-video overflow-hidden rounded-xl bg-night">
      {shown ? (
        <iframe
          src={embedUrl({ youtubeId, playlistId })}
          title={title}
          className="size-full"
          allow="encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button type="button" onClick={() => setShown(true)} className="tone-night grid size-full place-items-center gap-2 text-sand">
          <span className="grid size-16 place-items-center rounded-full bg-dawn text-night">
            <Play aria-hidden className="size-7 translate-x-0.5" />
          </span>
          <span className="font-medium">{t("showVideo")}</span>
        </button>
      )}
    </div>
  );
}
