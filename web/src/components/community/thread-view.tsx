"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useState, useSyncExternalStore, type FormEvent } from "react";

import { Lantern } from "@/components/journey/lantern";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { createReply, getThread, moderate, type Thread } from "@/lib/community/data";
import { isModerator, useStanding, type Standing } from "@/lib/community/membership";
import { LIMITS, type CommunityError, type Reply } from "@/lib/community/types";
import { cn } from "@/lib/utils";

import { AuthorLine } from "./author-line";
import { CalmLine, Failed, Loading, Quiet } from "./community-states";
import { HelpedButton, ReportControl } from "./post-actions";
import { PostTags } from "./post-card";
import { Counter } from "./post-composer";
import { ShareNotice, useShare } from "./share-checks";

const noSubscription = () => () => undefined;
const idInAddress = () => new URLSearchParams(window.location.search).get("id");
const hydratedSnapshot = () => true;
const serverSnapshot = () => false;

type View = { kind: "loading" } | { kind: "failed" } | { kind: "missing" } | { kind: "ready"; thread: Thread };

/** One post and its replies in time order. The post's id is read from the address in the browser. */
export function ThreadView() {
  const t = useTranslations("Community");
  const id = useSyncExternalStore(noSubscription, idInAddress, () => null);
  const hydrated = useSyncExternalStore(noSubscription, hydratedSnapshot, serverSnapshot);
  const { standing } = useStanding();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [round, setRound] = useState(0);
  const reload = useCallback(() => setRound((value) => value + 1), []);

  useEffect(() => {
    if (!id) return;
    let current = true;
    void getThread(id).then((result) => {
      if (!current) return;
      if (!result.ok) setView({ kind: "failed" });
      else setView(result.value ? { kind: "ready", thread: result.value } : { kind: "missing" });
    });
    return () => {
      current = false;
    };
  }, [id, round]);

  const back = (
    <Link href="/community" className="inline-flex min-h-11 items-center gap-2 font-medium underline-offset-4 hover:underline">
      <ArrowLeft aria-hidden className="size-4 rtl:-scale-x-100" />
      {t("back")}
    </Link>
  );

  if (hydrated && id === null) {
    return (
      <div className="grid gap-6">
        {back}
        <Quiet title={t("notFound.title")} body={t("notFound.body")} />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {back}
      {view.kind === "loading" && <Loading />}
      {view.kind === "failed" && <Failed onRetry={reload} />}
      {view.kind === "missing" && <Quiet title={t("notFound.title")} body={t("notFound.body")} />}
      {view.kind === "ready" && <ThreadBody thread={view.thread} standing={standing} onReplied={reload} />}
    </div>
  );
}

export function ThreadBody({ thread, standing, onReplied }: { thread: Thread; standing: Standing; onReplied: () => void }) {
  const t = useTranslations("Community");
  const { post, replies, mine } = thread;
  const canAct = standing.kind === "member";

  return (
    <>
      <article aria-labelledby="community-post-title" className="grid gap-4 rounded-2xl border border-hairline bg-card p-5 shadow-[0_1px_0_var(--hairline)] sm:p-7">
        <PostTags post={post} />
        <h1 id="community-post-title" lang={post.language} dir={post.language === "ar" ? "rtl" : "ltr"} className="font-display text-3xl leading-snug font-semibold text-balance">
          {post.title}
        </h1>
        <AuthorLine author={post.author} createdAt={post.createdAt} edited={post.editedAt !== null} />
        <div lang={post.language} dir={post.language === "ar" ? "rtl" : "ltr"} className="text-lg leading-loose whitespace-pre-line">
          {post.body}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
          <HelpedButton target={{ type: "post", id: post.id }} count={post.helped} mine={mine.helped.has(post.id)} canReact={canAct} />
          <Button asChild variant="outline" size="sm">
            <Link href={{ pathname: "/rafiq", query: { ask: t("askAboutPost", { title: post.title }) } }}>
              <Lantern className="size-5 text-foreground" />
              {t("askRafiq")}
            </Link>
          </Button>
          {canAct && mine.me !== post.authorId && <ReportControl target={{ type: "post", id: post.id }} />}
        </div>
        {isModerator(standing) && <ModeratorBar post={post.id} hidden={post.hidden} pinned={post.pinned} onChanged={onReplied} />}
      </article>

      <CalmLine />

      <section aria-labelledby="community-replies" className="grid gap-4">
        <h2 id="community-replies" className="font-display text-2xl font-semibold">
          {t("replies")} <span className="text-base font-normal text-muted-foreground">({replies.length})</span>
        </h2>
        {replies.length === 0 ? (
          <p className="text-muted-foreground">{t("noReplies")}</p>
        ) : (
          <ol className="grid gap-3">
            {replies.map((reply) => (
              <ReplyItem key={reply.id} reply={reply} helped={mine.helped.has(reply.id)} canAct={canAct} own={mine.me !== null && mine.me === reply.authorId} />
            ))}
          </ol>
        )}
      </section>

      <ReplyArea post={post.id} standing={standing} onReplied={onReplied} />
    </>
  );
}

function ModeratorBar({ post, hidden, pinned, onChanged }: { post: string; hidden: boolean; pinned: boolean; onChanged: () => void }) {
  const t = useTranslations("Community.moderation");
  const [busy, setBusy] = useState(false);
  async function act(change: { hidden?: boolean; pinned?: boolean }) {
    setBusy(true);
    const result = await moderate({ type: "post", id: post }, change);
    setBusy(false);
    if (result.ok) onChanged();
  }
  return (
    <div className="flex flex-wrap gap-2 rounded-xl bg-muted/60 p-2">
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act({ pinned: !pinned })}>
        {pinned ? t("unpin") : t("pin")}
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void act({ hidden: !hidden })}>
        {hidden ? t("unhide") : t("hide")}
      </Button>
    </div>
  );
}

function ReplyItem({ reply, helped, canAct, own }: { reply: Reply; helped: boolean; canAct: boolean; own: boolean }) {
  const t = useTranslations("Community");
  return (
    <li className={cn("grid gap-3 rounded-2xl border border-hairline bg-card p-4 sm:p-5", reply.hidden && "border-dashed opacity-80")}>
      <AuthorLine author={reply.author} createdAt={reply.createdAt} />
      {(reply.needsSpecialist || reply.hidden) && (
        <p className="flex flex-wrap gap-2 text-sm">
          {reply.needsSpecialist && <span className="rounded-full border border-terracotta/40 px-3 py-1 font-medium text-terracotta-text">{t("specialistTag")}</span>}
          {reply.hidden && <span className="rounded-full bg-muted px-3 py-1 font-medium">{t("hiddenTag")}</span>}
        </p>
      )}
      <p dir="auto" className="leading-loose whitespace-pre-line">
        {reply.body}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <HelpedButton target={{ type: "reply", id: reply.id }} count={reply.helped} mine={helped} canReact={canAct} />
        {canAct && !own && <ReportControl target={{ type: "reply", id: reply.id }} />}
      </div>
    </li>
  );
}

function ReplyArea({ post, standing, onReplied }: { post: string; standing: Standing; onReplied: () => void }) {
  const t = useTranslations("Community");
  if (standing.kind === "loading") return null;
  if (standing.kind !== "member") {
    return (
      <div className="grid justify-items-start gap-3 rounded-2xl border border-dashed border-hairline p-5">
        <p>{standing.kind === "signedIn" ? t("joinNote") : t("guestNote")}</p>
        <Button asChild variant="outline">
          <Link href={standing.kind === "signedIn" ? "/account#community" : "/account/sign-in"}>{t("join")}</Link>
        </Button>
      </div>
    );
  }
  return <ReplyBox post={post} onReplied={onReplied} />;
}

function ReplyBox({ post, onReplied }: { post: string; onReplied: () => void }) {
  const t = useTranslations("Community");
  const id = useId();
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const share = useShare(
    async (needsSpecialist) => {
      const result = await createReply(post, body, needsSpecialist);
      return result.ok ? { ok: true as const } : result;
    },
    () => {
      setBody("");
      setSent(true);
      onReplied();
    },
  );
  const notice = share.state.kind === "notice" ? share.state : null;
  const error: CommunityError | undefined = share.state.kind === "idle" ? share.state.error : undefined;

  function submit(event: FormEvent) {
    event.preventDefault();
    setSent(false);
    if (body.trim()) share.start(body.trim());
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-hairline bg-card p-4 sm:p-5">
      <label htmlFor={`${id}-reply`} className="font-display text-xl font-semibold">
        {t("replyBox.label")}
      </label>
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {t("replyBox.hint", { max: LIMITS.reply })}
      </p>
      <textarea
        id={`${id}-reply`}
        value={body}
        rows={4}
        maxLength={LIMITS.reply}
        dir="auto"
        readOnly={notice !== null || share.busy}
        onChange={(event) => setBody(event.target.value)}
        aria-describedby={`${id}-hint ${id}-count`}
        className="w-full min-w-0 rounded-xl border-2 border-border bg-background px-3 py-3 leading-relaxed"
      />
      <Counter id={`${id}-count`} count={body.length} max={LIMITS.reply} />
      {sent && (
        <p role="status" className="font-medium text-oasis-text">
          {t("replyBox.sent")}
        </p>
      )}
      {error && <Failed>{t(`errors.${error}`)}</Failed>}
      {notice ? (
        <ShareNotice state={notice} onPass={share.pass} onEdit={share.edit} />
      ) : (
        <Button type="submit" className="justify-self-start" disabled={share.busy || !body.trim()}>
          {share.state.kind === "checking" ? t("composer.checking") : share.state.kind === "sending" ? t("composer.sending") : t("replyBox.submit")}
        </Button>
      )}
    </form>
  );
}
