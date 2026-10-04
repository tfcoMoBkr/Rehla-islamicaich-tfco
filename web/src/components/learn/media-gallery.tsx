import { ExternalLink } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import type { MediaView } from "@/lib/learn/types";

import { YouTubeEmbed } from "./youtube-embed";

/** Pictures and clips added to a lesson, card or step, each with its credit. Empty slots show nothing. */
export function MediaGallery({ media }: { media: readonly MediaView[] }) {
  const t = useTranslations("Lesson");
  if (media.length === 0) return null;

  return (
    <div className="grid gap-4">
      {media.map((item) => (
        <figure key={item.kind === "image" ? item.src : item.youtubeId} className="animate-rise-in grid gap-2">
          {item.kind === "image" ? (
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
              <Image src={item.src} alt={item.alt} fill unoptimized sizes="(max-width: 42rem) 100vw, 42rem" className="object-contain" />
            </div>
          ) : (
            <YouTubeEmbed title={item.alt} youtubeId={item.youtubeId} />
          )}
          <figcaption className="text-xs text-muted-foreground">
            {item.kind === "video" && <span className="block text-sm text-foreground">{item.alt}</span>}
            {t("mediaCredit")} {item.credit} · {item.licence} ·{" "}
            <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
              {t("mediaSource")}
              <ExternalLink aria-hidden className="size-3" />
            </a>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
