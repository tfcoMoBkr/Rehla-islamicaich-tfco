"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { createPost } from "@/lib/community/data";
import { useStanding } from "@/lib/community/membership";
import { CATEGORIES, LIMITS, type Category } from "@/lib/community/types";
import { cn } from "@/lib/utils";

import { Failed, Loading, Quiet } from "./community-states";
import { ShareNotice, useShare } from "./share-checks";

const FIELD = "w-full min-w-0 rounded-xl border-2 border-border bg-card px-3 text-base";

/** Writing a post: a category, the post's language, a title and the text, then the checks. */
export function PostComposer() {
  const t = useTranslations("Community");
  const { standing, refresh } = useStanding();

  if (standing.kind === "loading") return <Loading />;
  if (standing.kind === "failed") return <Failed onRetry={refresh} />;
  if (standing.kind !== "member") {
    return (
      <Quiet
        title={t("composer.notMember")}
        action={
          <Button asChild>
            <Link href={standing.kind === "guest" ? "/account/sign-in" : "/account#community"}>{t("join")}</Link>
          </Button>
        }
      />
    );
  }
  return <ComposerForm />;
}

function ComposerForm() {
  const t = useTranslations("Community");
  const locale = useLocale() as "ar" | "en";
  const router = useRouter();
  const id = useId();
  const [category, setCategory] = useState<Category | null>(null);
  const [language, setLanguage] = useState<"ar" | "en">(locale);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [missing, setMissing] = useState(false);
  const created = useRef<string | null>(null);

  const share = useShare(
    async (needsSpecialist) => {
      const result = await createPost({ category: category!, title, body, language, needsSpecialist });
      if (result.ok) created.current = result.value;
      return result;
    },
    () => router.push({ pathname: "/community/post", query: { id: created.current! } }),
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    const ready = category !== null && title.trim().length > 0 && body.trim().length > 0;
    setMissing(!ready);
    if (ready) share.start(`${title.trim()}\n\n${body.trim()}`);
  }

  const notice = share.state.kind === "notice" ? share.state : null;

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <fieldset className="grid gap-3" disabled={notice !== null || share.busy}>
        <legend className="mb-2 font-semibold">{t("composer.category")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {CATEGORIES.map((option) => (
            <label
              key={option}
              className={cn(
                "grid cursor-pointer gap-1 rounded-2xl border-2 p-4 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                category === option ? "border-oasis bg-oasis/8" : "border-hairline bg-card hover:border-foreground/30",
              )}
            >
              <span className="flex items-center gap-2 font-semibold">
                <input type="radio" name={`${id}-category`} value={option} checked={category === option} onChange={() => setCategory(option)} className="size-4 accent-oasis" />
                {t(`categories.${option}`)}
              </span>
              <span className="text-sm text-muted-foreground">{t(`categoryHints.${option}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-2" disabled={notice !== null || share.busy}>
        <legend className="mb-2 font-semibold">{t("composer.language")}</legend>
        <div className="flex flex-wrap gap-2">
          {(["ar", "en"] as const).map((option) => (
            <label key={option} className={cn("inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-4", language === option ? "border-oasis bg-oasis/8" : "border-hairline")}>
              <input type="radio" name={`${id}-language`} value={option} checked={language === option} onChange={() => setLanguage(option)} className="size-4 accent-oasis" />
              <span lang={option}>{t(`languages.${option}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-1.5">
        <label htmlFor={`${id}-title`} className="font-semibold">
          {t("composer.titleLabel")}
        </label>
        <input
          id={`${id}-title`}
          value={title}
          maxLength={LIMITS.title}
          onChange={(event) => setTitle(event.target.value)}
          readOnly={notice !== null || share.busy}
          lang={language}
          dir={language === "ar" ? "rtl" : "ltr"}
          className={cn(FIELD, "min-h-12")}
          aria-describedby={`${id}-title-count`}
        />
        <Counter id={`${id}-title-count`} count={title.length} max={LIMITS.title} />
      </div>

      <div className="grid gap-1.5">
        <label htmlFor={`${id}-body`} className="font-semibold">
          {t("composer.bodyLabel")}
        </label>
        <textarea
          id={`${id}-body`}
          value={body}
          rows={8}
          maxLength={LIMITS.body}
          onChange={(event) => setBody(event.target.value)}
          readOnly={notice !== null || share.busy}
          lang={language}
          dir={language === "ar" ? "rtl" : "ltr"}
          className={cn(FIELD, "py-3 leading-relaxed")}
          aria-describedby={`${id}-body-count`}
        />
        <Counter id={`${id}-body-count`} count={body.length} max={LIMITS.body} />
      </div>

      {missing && (
        <p role="alert" className="font-medium text-destructive">
          {t("composer.missing")}
        </p>
      )}
      {share.state.kind === "idle" && share.state.error && <Failed>{t(`errors.${share.state.error}`)}</Failed>}

      {notice ? (
        <ShareNotice state={notice} onPass={share.pass} onEdit={share.edit} />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={share.busy}>
            {share.state.kind === "checking" ? t("composer.checking") : share.state.kind === "sending" ? t("composer.sending") : t("composer.submit")}
          </Button>
          <Button asChild variant="ghost">
            <Link href="/community">{t("back")}</Link>
          </Button>
        </div>
      )}
    </form>
  );
}

export function Counter({ id, count, max }: { id: string; count: number; max: number }) {
  const t = useTranslations("Community.composer");
  return (
    <p id={id} className={cn("justify-self-end text-xs tabular-nums", count >= max ? "font-semibold text-terracotta-text" : "text-muted-foreground")}>
      {t("counter", { count, max })}
    </p>
  );
}
