"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState, type FormEvent } from "react";

import { RulesList } from "@/components/community/community-states";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { join, leave, myPosts, updateMembership } from "@/lib/community/data";
import { useStanding } from "@/lib/community/membership";
import { LIMITS, type CommunityError, type Membership, type Post } from "@/lib/community/types";

import { Field, FormMessage, TextInput } from "./fields";

const validName = (name: string): boolean => name.trim().length >= LIMITS.nameMin && name.trim().length <= LIMITS.nameMax;

/** Rehla Community from the account: joining is its own choice, with a name chosen for it. */
export function CommunitySection({ hasCountry }: { hasCountry: boolean }) {
  const t = useTranslations("Community.account");
  const { standing, refresh } = useStanding();
  const [notice, setNotice] = useState<"joined" | "left" | null>(null);

  return (
    <section id="community" aria-labelledby="account-community" className="grid scroll-mt-24 gap-4 border-t border-hairline pt-8">
      <h2 id="account-community" className="font-display text-2xl font-semibold">
        {t("title")}
      </h2>
      <p className="text-muted-foreground">{t("intro")}</p>
      {notice && <FormMessage tone="done">{t(notice)}</FormMessage>}
      {standing.kind === "loading" && (
        <p role="status" className="text-muted-foreground">
          {t("working")}
        </p>
      )}
      {(standing.kind === "signedIn" || standing.kind === "guest") && (
        <JoinForm
          hasCountry={hasCountry}
          onJoined={() => {
            setNotice("joined");
            refresh();
          }}
        />
      )}
      {standing.kind === "member" && (
        <>
          <Settings membership={standing.membership} hasCountry={hasCountry} />
          <MyPosts />
          <Leave
            onLeft={() => {
              setNotice("left");
              refresh();
            }}
          />
        </>
      )}
      {standing.kind === "failed" && <CommunityMessage error="network" />}
    </section>
  );
}

function CommunityMessage({ error }: { error: CommunityError }) {
  const t = useTranslations("Community");
  return <FormMessage tone="error">{t(`errors.${error}`)}</FormMessage>;
}

function NameAndCountry({ name, onName, showCountry, onShowCountry, hasCountry, nameError }: { name: string; onName: (name: string) => void; showCountry: boolean; onShowCountry: (show: boolean) => void; hasCountry: boolean; nameError: boolean }) {
  const t = useTranslations("Community.account");
  const id = useId();
  const limits = { min: LIMITS.nameMin, max: LIMITS.nameMax };
  return (
    <>
      <Field label={t("nameLabel")} hint={t("nameHint", limits)} error={nameError ? t("nameInvalid", limits) : null}>
        {(props) => <TextInput {...props} value={name} maxLength={LIMITS.nameMax} autoComplete="off" dir="auto" onChange={(event) => onName(event.target.value)} />}
      </Field>
      <div className="grid gap-1">
        <label htmlFor={`${id}-country`} className="flex min-h-11 items-center gap-3">
          <input id={`${id}-country`} type="checkbox" checked={showCountry} disabled={!hasCountry} onChange={(event) => onShowCountry(event.target.checked)} className="size-5 accent-oasis" />
          {t("showCountry")}
        </label>
        {!hasCountry && <p className="text-sm text-muted-foreground">{t("noCountry")}</p>}
      </div>
    </>
  );
}

export function JoinForm({ hasCountry, onJoined }: { hasCountry: boolean; onJoined: () => void }) {
  const t = useTranslations("Community.account");
  const tr = useTranslations("Community.rules");
  const id = useId();
  const [name, setName] = useState("");
  const [showCountry, setShowCountry] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CommunityError | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (!validName(name) || !accepted) return;
    setBusy(true);
    const result = await join(name, showCountry && hasCountry);
    setBusy(false);
    if (result.ok) onJoined();
    else setError(result.error);
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 rounded-2xl border border-hairline bg-background p-5">
      <NameAndCountry name={name} onName={setName} showCountry={showCountry} onShowCountry={setShowCountry} hasCountry={hasCountry} nameError={tried && !validName(name)} />
      <div className="grid gap-3">
        <h3 className="font-semibold">{t("rulesTitle")}</h3>
        <div aria-label={tr("title")} className="rounded-xl border border-hairline bg-card p-4">
          <RulesList />
        </div>
        <label htmlFor={`${id}-accept`} className="flex min-h-11 items-center gap-3 font-medium">
          <input id={`${id}-accept`} type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} aria-invalid={tried && !accepted ? true : undefined} className="size-5 accent-oasis" />
          {t("accept")}
        </label>
        {tried && !accepted && <p className="text-sm font-medium text-destructive">{t("acceptMissing")}</p>}
      </div>
      {error && <CommunityMessage error={error} />}
      <Button type="submit" className="justify-self-start" disabled={busy}>
        {busy ? t("working") : t("joinSubmit")}
      </Button>
    </form>
  );
}

function Settings({ membership, hasCountry }: { membership: Membership; hasCountry: boolean }) {
  const t = useTranslations("Community.account");
  const tc = useTranslations("Community");
  const [name, setName] = useState(membership.name);
  const [showCountry, setShowCountry] = useState(membership.showCountry);
  const [state, setState] = useState<"idle" | "busy" | "saved" | CommunityError>("idle");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validName(name)) return;
    setState("busy");
    const result = await updateMembership(name, showCountry && hasCountry);
    setState(result.ok ? "saved" : result.error);
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5 rounded-2xl border border-hairline bg-background p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{t("settingsTitle")}</h3>
        {membership.role !== "member" && <span className="rounded-full bg-oasis/12 px-3 py-1 text-sm font-semibold text-oasis-text">{t("badge", { badge: tc(`badges.${membership.role}`) })}</span>}
      </div>
      <NameAndCountry name={name} onName={setName} showCountry={showCountry} onShowCountry={setShowCountry} hasCountry={hasCountry} nameError={!validName(name)} />
      {state === "saved" && <FormMessage tone="done">{t("saved")}</FormMessage>}
      {state !== "idle" && state !== "busy" && state !== "saved" && <CommunityMessage error={state} />}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={state === "busy"}>
          {state === "busy" ? t("working") : t("save")}
        </Button>
        <Button asChild variant="outline">
          <Link href="/community">{t("open")}</Link>
        </Button>
      </div>
    </form>
  );
}

function MyPosts() {
  const t = useTranslations("Community.account");
  const [posts, setPosts] = useState<Post[] | null | "failed">(null);

  useEffect(() => {
    let current = true;
    void myPosts().then((result) => {
      if (current) setPosts(result.ok ? result.value : "failed");
    });
    return () => {
      current = false;
    };
  }, []);

  return (
    <div className="grid gap-3">
      <h3 className="font-semibold">{t("myPosts")}</h3>
      {posts === null && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("working")}
        </p>
      )}
      {posts === "failed" && <CommunityMessage error="network" />}
      {Array.isArray(posts) && posts.length === 0 && <p className="text-muted-foreground">{t("noPosts")}</p>}
      {Array.isArray(posts) && posts.length > 0 && (
        <ul className="grid gap-2">
          {posts.map((post) => (
            <li key={post.id}>
              <Link href={{ pathname: "/community/post", query: { id: post.id } }} dir="auto" className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">
                {post.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Leave({ onLeft }: { onLeft: () => void }) {
  const t = useTranslations("Community.account");
  const id = useId();
  const [keep, setKeep] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CommunityError | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (keep === null) return;
    setBusy(true);
    const result = await leave(keep);
    setBusy(false);
    if (result.ok) onLeft();
    else setError(result.error);
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-dashed border-hairline p-5">
      <fieldset className="grid gap-2">
        <legend className="mb-1 font-semibold">{t("leaveTitle")}</legend>
        <p className="text-muted-foreground">{t("leaveBody")}</p>
        {([true, false] as const).map((option) => (
          <label key={String(option)} className="flex min-h-11 items-center gap-3">
            <input type="radio" name={`${id}-keep`} checked={keep === option} onChange={() => setKeep(option)} className="size-5 accent-terracotta" />
            {option ? t("leaveKeep") : t("leaveDelete")}
          </label>
        ))}
      </fieldset>
      {error && <CommunityMessage error={error} />}
      <Button type="submit" variant="outline" className="justify-self-start" disabled={keep === null || busy}>
        {busy ? t("working") : t("leaveConfirm")}
      </Button>
    </form>
  );
}
