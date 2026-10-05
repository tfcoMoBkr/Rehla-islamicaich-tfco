"use client";

import { Pin } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { Post } from "@/lib/community/types";

import { AuthorLine } from "./author-line";

export function PostTags({ post }: { post: Post }) {
  const t = useTranslations("Community");
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <span className="rounded-full bg-oasis/10 px-3 py-1 font-semibold text-oasis-text">{t(`categories.${post.category}`)}</span>
      {post.pinned && (
        <span className="inline-flex items-center gap-1 rounded-full bg-dawn/15 px-3 py-1 font-semibold">
          <Pin aria-hidden className="size-3.5" />
          {t("pinned")}
        </span>
      )}
      {post.needsSpecialist && <span className="rounded-full border border-terracotta/40 px-3 py-1 font-medium text-terracotta-text">{t("specialistTag")}</span>}
      {post.hidden && <span className="rounded-full bg-muted px-3 py-1 font-medium">{t("hiddenTag")}</span>}
      {post.isSample && <SampleBadge />}
    </p>
  );
}

/** Marks an illustration written by the Rehla team, never a real member's words. */
export function SampleBadge() {
  const t = useTranslations("Community.sample");
  return <span className="rounded-full border-2 border-dashed border-ink/40 px-3 py-0.5 text-sm font-semibold">{t("badge")}</span>;
}

export function PostCard({ post }: { post: Post }) {
  const t = useTranslations("Community");
  return (
    <article className="relative grid gap-2 rounded-2xl border border-hairline bg-card p-4 transition-colors focus-within:border-foreground/40 hover:border-foreground/30 sm:p-5">
      <PostTags post={post} />
      <h3 lang={post.language} dir={post.language === "ar" ? "rtl" : "ltr"} className="font-display text-xl leading-snug font-semibold">
        <Link href={{ pathname: "/community/post", query: { id: post.id } }} className="after:absolute after:inset-0 after:rounded-2xl">
          {post.title}
        </Link>
      </h3>
      <p lang={post.language} dir={post.language === "ar" ? "rtl" : "ltr"} className="line-clamp-2 text-muted-foreground">
        {post.body}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AuthorLine author={post.author} createdAt={post.createdAt} />
        <p className="text-sm text-muted-foreground">
          {t("replyCount", { count: post.replies })}
          {post.helped > 0 && ` · ${t("helpedCount", { count: post.helped })}`}
        </p>
      </div>
    </article>
  );
}
