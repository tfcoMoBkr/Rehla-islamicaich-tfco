"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { SharedPost } from "@/lib/rafiq/shared-post";
import { cn } from "@/lib/utils";

/** A community post quoted above the learner's question: another member's words, for context. */
export function SharedPostQuote({ post, onRemove, className }: { post: SharedPost; onRemove?: () => void; className?: string }) {
  const t = useTranslations("Rafiq.shared");
  return (
    <figure className={cn("grid gap-2 rounded-2xl border border-hairline border-s-4 border-s-dawn bg-sand p-4", className)}>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
        <span>
          {t("from")} · {t("note")}
        </span>
        {onRemove && (
          <Button type="button" variant="ghost" size="xs" onClick={onRemove}>
            <X aria-hidden />
            {t("remove")}
          </Button>
        )}
      </figcaption>
      <blockquote className="grid gap-2">
        <p dir="auto" className="font-semibold">
          {post.title}
        </p>
        {post.body && (
          <p dir="auto" className="leading-relaxed whitespace-pre-line">
            {post.body}
          </p>
        )}
        {post.reply && (
          <div className="grid gap-1 border-s-2 border-hairline ps-3">
            <p className="text-xs font-semibold text-muted-foreground">{t("reply")}</p>
            <p dir="auto" className="leading-relaxed whitespace-pre-line">
              {post.reply}
            </p>
          </div>
        )}
      </blockquote>
      {post.shortened && <p className="text-xs text-muted-foreground">{t("shortened")}</p>}
    </figure>
  );
}
