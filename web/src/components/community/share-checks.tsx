"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { ReferralCard } from "@/components/rafiq/referral-card";
import { SpecialistCard } from "@/components/specialists/specialist-card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { advance, checkText, noticesFor, STOPS, type Pending } from "@/lib/community/checks";
import type { CommunityError } from "@/lib/community/types";
import { QUESTION_MAX_LENGTH } from "@/lib/rafiq/ask";

type Send = (needsSpecialist: boolean) => Promise<{ ok: true } | { ok: false; error: CommunityError }>;

export type ShareState =
  | { kind: "idle"; error?: CommunityError }
  | { kind: "checking" }
  | ({ kind: "notice"; text: string } & Pending)
  | { kind: "sending" };

/**
 * Sharing goes through the checks in order, one notice at a time. Every notice can be passed:
 * the writer decides. "Edit" returns to the text, kept as it was.
 */
export function useShare(send: Send, onSent: () => void) {
  const locale = useLocale() as "ar" | "en";
  const [state, setState] = useState<ShareState>({ kind: "idle" });

  async function finish(tagged: boolean) {
    setState({ kind: "sending" });
    const result = await send(tagged);
    if (result.ok) {
      setState({ kind: "idle" });
      onSent();
    } else setState({ kind: "idle", error: result.error });
  }

  async function start(text: string) {
    setState({ kind: "checking" });
    const notices = noticesFor(text, await checkText(text, locale));
    if (notices.length === 0) return finish(false);
    setState({ kind: "notice", text, notices, index: 0, tagged: false });
  }

  function pass(tag = false) {
    if (state.kind !== "notice") return;
    const next = advance(state, tag);
    if ("share" in next) void finish(next.needsSpecialist);
    else setState({ ...state, ...next });
  }

  return {
    state,
    busy: state.kind === "checking" || state.kind === "sending",
    start: (text: string) => void start(text),
    pass,
    edit: () => setState({ kind: "idle" }),
  };
}

/** The notice the writer is looking at, with its way on and its way back. */
export function ShareNotice({ state, onPass, onEdit }: { state: Extract<ShareState, { kind: "notice" }>; onPass: (tag?: boolean) => void; onEdit: () => void }) {
  const t = useTranslations("Community.notices");
  const heading = useRef<HTMLParagraphElement>(null);
  const notice = state.notices[state.index]!;

  useEffect(() => heading.current?.focus(), [state.index]);

  return (
    <section aria-live="polite" className="grid gap-4 rounded-2xl border-2 border-hairline bg-card p-4 sm:p-5">
      <p ref={heading} tabIndex={-1} className="text-sm font-semibold text-muted-foreground outline-none">
        {t("step", { current: state.index + 1, total: state.notices.length })}
      </p>
      {notice.kind === "care" && (
        <>
          <ReferralCard reason={notice.danger ? "danger" : "distress"} links={["/talk-to-a-specialist"]} />
          <SpecialistCard />
          <p>{t("careNote")}</p>
        </>
      )}
      {notice.kind === "personalData" && (
        <div className="grid gap-2">
          <p className="font-display text-lg font-semibold">{t("personalDataTitle")}</p>
          <p className="leading-relaxed">{t("personalDataBody", { found: notice.found.map((kind) => t(`found.${kind}`)).join(" · ") })}</p>
        </div>
      )}
      {notice.kind === "held" && (
        <div className="grid gap-2">
          <p className="font-display text-lg font-semibold">{t("heldTitle")}</p>
          <p className="leading-relaxed">{t("heldBody")}</p>
        </div>
      )}
      {(notice.kind === "ruling" || notice.kind === "religious") && (
        <div className="grid gap-3">
          <p className="font-display text-lg font-semibold">{t(notice.kind === "ruling" ? "rulingTitle" : "religiousTitle")}</p>
          <p className="leading-relaxed">{t(notice.kind === "ruling" ? "rulingBody" : "religiousBody")}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={{ pathname: "/rafiq", query: { ask: state.text.slice(0, QUESTION_MAX_LENGTH) } }}>{t("askRafiq")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/talk-to-a-specialist">{t("askSpecialist")}</Link>
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-3 border-t border-hairline pt-4">
        <Button type="button" variant="outline" onClick={onEdit}>
          {t("edit")}
        </Button>
        {STOPS.has(notice.kind) ? null : notice.kind === "ruling" ? (
          <Button type="button" variant="ghost" className="h-auto min-h-11 whitespace-normal text-start" onClick={() => onPass(true)}>
            {t("postTagged")}
          </Button>
        ) : (
          <Button type="button" variant="ghost" onClick={() => onPass()}>
            {t("postAnyway")}
          </Button>
        )}
      </div>
    </section>
  );
}
