import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const RULES = ["kind", "experience", "source", "privacy", "noAds", "report", "care"] as const;

/** The community rules as the team wrote them in the message files; the same list is accepted on joining. */
export function RulesList({ className }: { className?: string }) {
  const t = useTranslations("Community.rules");
  return (
    <ol className={cn("grid list-inside list-decimal gap-2 leading-relaxed marker:font-semibold marker:text-oasis-text", className)}>
      {RULES.map((rule) => (
        <li key={rule}>{t(rule)}</li>
      ))}
    </ol>
  );
}

export function CalmLine({ className }: { className?: string }) {
  const t = useTranslations("Community");
  return <p className={cn("rounded-2xl border-s-4 border-s-dawn bg-dawn/10 px-4 py-3 leading-relaxed", className)}>{t("calmLine")}</p>;
}

export function Loading({ label }: { label?: string }) {
  const t = useTranslations("Community");
  return (
    <div role="status" className="grid gap-3">
      <span className="sr-only">{label ?? t("loading")}</span>
      {[0, 1, 2].map((row) => (
        <div key={row} aria-hidden className="h-24 animate-pulse rounded-2xl bg-hairline/60 motion-reduce:animate-none" />
      ))}
    </div>
  );
}

export function Failed({ onRetry, children }: { onRetry?: () => void; children?: ReactNode }) {
  const t = useTranslations("Community");
  return (
    <div role="alert" className="grid justify-items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/6 p-5">
      <p className="font-medium">{children ?? t("error")}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          {t("retry")}
        </Button>
      )}
    </div>
  );
}

/** A calm, designed empty place: the road continues, nothing is written on it yet. */
export function Quiet({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed border-hairline px-5 py-10 text-center">
      <svg aria-hidden viewBox="0 0 120 40" className="h-10 w-32 text-dawn">
        <path d="M4 32 C 30 32, 34 8, 60 8 S 92 32, 116 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 9" />
      </svg>
      <p className="font-display text-xl font-semibold">{title}</p>
      {body && <p className="max-w-md text-muted-foreground">{body}</p>}
      {action}
    </div>
  );
}
