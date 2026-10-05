"use client";

import { PenLine, ShieldCheck, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { listPosts } from "@/lib/community/data";
import { isModerator, useStanding, type Standing } from "@/lib/community/membership";
import { CATEGORIES, type Category, type Post } from "@/lib/community/types";
import { cn } from "@/lib/utils";

import { Failed, Loading, Quiet } from "./community-states";
import { PostCard } from "./post-card";

type View = { kind: "loading" } | { kind: "failed" } | { kind: "ready"; posts: Post[] };

/** The community's front: who may do what, the filters, pinned posts, then the latest. */
export function CommunityHome() {
  const t = useTranslations("Community");
  const { standing } = useStanding();
  const [category, setCategory] = useState<Category | null>(null);
  const [language, setLanguage] = useState<"ar" | "en" | null>(null);
  const [view, setView] = useState<View>({ kind: "loading" });
  const [round, setRound] = useState(0);
  const retry = useCallback(() => setRound((value) => value + 1), []);

  useEffect(() => {
    let current = true;
    void listPosts({ category, language }).then((result) => {
      if (current) setView(result.ok ? { kind: "ready", posts: result.value } : { kind: "failed" });
    });
    return () => {
      current = false;
    };
  }, [category, language, round]);

  const choose = (next: () => void) => {
    setView({ kind: "loading" });
    next();
  };

  const pinned = view.kind === "ready" ? view.posts.filter((post) => post.pinned) : [];
  const latest = view.kind === "ready" ? view.posts.filter((post) => !post.pinned) : [];

  return (
    <div className="grid gap-8">
      <Invitation standing={standing} />

      <div className="grid gap-4 rounded-2xl border border-hairline bg-card p-4 sm:p-5">
        <ChipGroup label={t("filters.category")}>
          <Chip pressed={category === null} onClick={() => choose(() => setCategory(null))}>
            {t("filters.all")}
          </Chip>
          {CATEGORIES.map((option) => (
            <Chip key={option} pressed={category === option} onClick={() => choose(() => setCategory(option))}>
              {t(`categories.${option}`)}
            </Chip>
          ))}
        </ChipGroup>
        <ChipGroup label={t("filters.language")}>
          <Chip pressed={language === null} onClick={() => choose(() => setLanguage(null))}>
            {t("filters.bothLanguages")}
          </Chip>
          {(["ar", "en"] as const).map((option) => (
            <Chip key={option} pressed={language === option} lang={option} onClick={() => choose(() => setLanguage(option))}>
              {t(`languages.${option}`)}
            </Chip>
          ))}
        </ChipGroup>
      </div>

      {view.kind === "loading" && <Loading />}
      {view.kind === "failed" && <Failed onRetry={retry} />}
      {view.kind === "ready" && view.posts.length === 0 && (
        <Quiet
          title={t("empty.title")}
          body={t("empty.body")}
          action={
            standing.kind === "member" ? (
              <Button asChild>
                <Link href="/community/write">{t("empty.member")}</Link>
              </Button>
            ) : undefined
          }
        />
      )}
      {pinned.length > 0 && <PostList id="community-pinned" title={t("pinned")} posts={pinned} />}
      {latest.length > 0 && <PostList id="community-latest" title={t("latest")} posts={latest} />}
    </div>
  );
}

export function Invitation({ standing }: { standing: Standing }) {
  const t = useTranslations("Community");
  if (standing.kind === "loading" || standing.kind === "failed") return null;
  if (standing.kind === "member") {
    return (
      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/community/write">
            <PenLine aria-hidden />
            {t("write")}
          </Link>
        </Button>
        {isModerator(standing) && (
          <Button asChild variant="outline" size="lg">
            <Link href="/community/review">
              <ShieldCheck aria-hidden />
              {t("review")}
            </Link>
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="grid justify-items-start gap-3 rounded-2xl border border-oasis/30 bg-oasis/6 p-5">
      <p className="leading-relaxed">{standing.kind === "signedIn" ? t("joinNote") : t("guestNote")}</p>
      <Button asChild>
        <Link href={standing.kind === "signedIn" ? "/account#community" : "/account/sign-in"}>
          <Users aria-hidden />
          {t("join")}
        </Link>
      </Button>
    </div>
  );
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="grid gap-2">
      <p aria-hidden className="text-sm font-semibold text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ pressed, onClick, lang, children }: { pressed: boolean; onClick: () => void; lang?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      lang={lang}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border-2 px-4 text-sm font-medium transition-colors",
        pressed ? "border-ink bg-ink text-sand" : "border-hairline bg-background hover:border-foreground/40",
      )}
    >
      {children}
    </button>
  );
}

function PostList({ id, title, posts }: { id: string; title: string; posts: Post[] }) {
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <h2 id={id} className="font-display text-2xl font-semibold">
        {title}
      </h2>
      <ul className="grid gap-3">
        {posts.map((post) => (
          <li key={post.id}>
            <PostCard post={post} />
          </li>
        ))}
      </ul>
    </section>
  );
}
