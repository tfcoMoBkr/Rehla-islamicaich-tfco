"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { moderate, reviewList, type ReviewItem } from "@/lib/community/data";
import { isModerator, useStanding } from "@/lib/community/membership";
import type { CommunityError } from "@/lib/community/types";

import { Failed, Loading, Quiet } from "./community-states";

type View = { kind: "loading" } | { kind: "failed" } | { kind: "ready"; items: ReviewItem[] };

/** For the Rehla team: hidden and reported items, to unhide, keep hidden, hide or pin. */
export function ReviewList() {
  const t = useTranslations("Community.moderation");
  const { standing } = useStanding();
  const allowed = isModerator(standing);
  const [view, setView] = useState<View>({ kind: "loading" });
  const [round, setRound] = useState(0);
  const reload = useCallback(() => setRound((value) => value + 1), []);

  useEffect(() => {
    if (!allowed) return;
    let current = true;
    void reviewList().then((result) => {
      if (current) setView(result.ok ? { kind: "ready", items: result.value } : { kind: "failed" });
    });
    return () => {
      current = false;
    };
  }, [allowed, round]);

  if (standing.kind === "loading") return <Loading />;
  if (!allowed) return <Quiet title={t("notModerator")} />;
  if (view.kind === "loading") return <Loading />;
  if (view.kind === "failed") return <Failed onRetry={reload} />;
  if (view.items.length === 0) return <Quiet title={t("empty")} />;

  return (
    <ul className="grid gap-3">
      {view.items.map((item) => (
        <li key={`${item.type}-${item.id}`}>
          <ReviewCard item={item} onChanged={reload} />
        </li>
      ))}
    </ul>
  );
}

function ReviewCard({ item, onChanged }: { item: ReviewItem; onChanged: () => void }) {
  const t = useTranslations("Community.moderation");
  const tr = useTranslations("Community");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CommunityError | null>(null);

  async function act(change: Parameters<typeof moderate>[1]) {
    setBusy(true);
    setError(null);
    const result = await moderate(item, change);
    setBusy(false);
    if (result.ok) onChanged();
    else setError(result.error);
  }

  return (
    <article className="grid gap-3 rounded-2xl border border-hairline bg-card p-4 sm:p-5">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-muted px-3 py-1 font-semibold">{t(item.type)}</span>
        {item.hidden && <span className="rounded-full bg-terracotta/10 px-3 py-1 font-semibold text-terracotta-text">{t("hidden")}</span>}
        <span className="text-muted-foreground">{t("reports", { count: item.reports.length })}</span>
      </p>
      {item.title && (
        <h2 dir="auto" className="font-display text-xl font-semibold">
          {item.title}
        </h2>
      )}
      <p dir="auto" className="line-clamp-4 leading-relaxed whitespace-pre-line">
        {item.body}
      </p>
      {item.reports.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-sm">
          {[...new Set(item.reports)].map((reason) => (
            <li key={reason} className="rounded-full border border-hairline px-3 py-1">
              {tr(`report.reasons.${reason}`)} × {item.reports.filter((given) => given === reason).length}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {tr(`errors.${error}`)}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {item.hidden ? (
          <>
            <Button size="sm" disabled={busy} onClick={() => void act({ hidden: false, clearReports: true })}>
              {t("unhide")}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void act({ clearReports: true })}>
              {t("keepHidden")}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void act({ hidden: true })}>
            {t("hide")}
          </Button>
        )}
        {item.type === "post" && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act({ pinned: !item.pinned })}>
            {item.pinned ? t("unpin") : t("pin")}
          </Button>
        )}
        <Button asChild size="sm" variant="link">
          <Link href={{ pathname: "/community/post", query: { id: item.post } }}>{t("openThread")}</Link>
        </Button>
      </div>
    </article>
  );
}
