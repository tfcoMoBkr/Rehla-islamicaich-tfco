"use client";

import { Flag, HeartHandshake } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { report, setHelped } from "@/lib/community/data";
import { REPORT_REASONS, type CommunityError, type ReportReason } from "@/lib/community/types";
import { cn } from "@/lib/utils";

type Target = { type: "post" | "reply"; id: string };

/** "This helped me": one per member, taken back by pressing again. Guests see the count only. */
export function HelpedButton({ target, count, mine, canReact }: { target: Target; count: number; mine: boolean; canReact: boolean }) {
  const t = useTranslations("Community");
  const [state, setState] = useState({ mine, count });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CommunityError | null>(null);

  async function toggle() {
    const next = !state.mine;
    setBusy(true);
    setError(null);
    const result = await setHelped(target.type === "post" ? { post: target.id } : { reply: target.id }, next);
    setBusy(false);
    if (result.ok) setState({ mine: next, count: state.count + (next ? 1 : -1) });
    else setError(result.error);
  }

  const label = state.count > 0 ? t("helpedCount", { count: state.count }) : null;
  if (!canReact) return label ? <p className="text-sm text-muted-foreground">{label}</p> : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" aria-pressed={state.mine} disabled={busy} onClick={() => void toggle()} className={cn(state.mine && "border-oasis bg-oasis/10 text-oasis-text")}>
        <HeartHandshake aria-hidden />
        {t("helped")}
      </Button>
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
      {error && (
        <span role="alert" className="text-sm text-destructive">
          {t(`errors.${error}`)}
        </span>
      )}
    </div>
  );
}

/** Reporting with a reason. Reporting twice counts once. */
export function ReportControl({ target }: { target: Target }) {
  const t = useTranslations("Community.report");
  const tc = useTranslations("Community");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "done" | CommunityError>("idle");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reason) return;
    setState("sending");
    const result = await report(target.type, target.id, reason);
    setState(result.ok ? "done" : result.error);
  }

  if (state === "done") {
    return (
      <p role="status" className="text-sm font-medium text-oasis-text">
        {t("done")}
      </p>
    );
  }
  if (!open) {
    return (
      <Button variant="ghost" size="sm" aria-expanded={false} onClick={() => setOpen(true)} className="text-muted-foreground">
        <Flag aria-hidden />
        {t("button")}
      </Button>
    );
  }
  return (
    <form onSubmit={submit} className="grid w-full gap-3 rounded-2xl border border-hairline bg-background p-4">
      <fieldset className="grid gap-2">
        <legend id={`${id}-legend`} className="mb-1 font-semibold">
          {t("title")}
        </legend>
        {REPORT_REASONS.map((option) => (
          <label key={option} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-accent">
            <input type="radio" name={`${id}-reason`} value={option} checked={reason === option} onChange={() => setReason(option)} className="size-4 accent-terracotta" />
            {t(`reasons.${option}`)}
          </label>
        ))}
      </fieldset>
      {state !== "idle" && state !== "sending" && (
        <p role="alert" className="text-sm text-destructive">
          {tc(`errors.${state}`)}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={!reason || state === "sending"}>
          {t("submit")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
