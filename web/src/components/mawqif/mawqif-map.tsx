"use client";

import { ArrowRight, Check, Flag, Footprints } from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment } from "react";

import { Link } from "@/i18n/navigation";
import { ratio } from "@/lib/learn/progress";
import { useProgress } from "@/lib/learn/progress-store";
import { nextStop, situationStatus, testRoundKey, type SituationStatus } from "@/lib/mawqif/progress";
import type { SituationStop, TestGroup } from "@/lib/mawqif/types";
import { cn } from "@/lib/utils";

import { SituationArt } from "./situation-art";

const MARKER: Record<SituationStatus, string> = {
  notStarted: "border-hairline bg-paper text-muted-foreground",
  practised: "border-dawn bg-dawn/20 text-ink",
  mastered: "border-oasis bg-oasis text-paper",
};

/**
 * The situations as stops on the road, in order, each marked not started, practised or mastered,
 * with a test after every few stops and one for the whole section. Progress is read on the
 * device, so the server renders every stop as not started.
 */
export function MawqifMap({ stops, tests }: { stops: readonly SituationStop[]; tests: readonly TestGroup[] }) {
  const t = useTranslations("Mawqif");
  const progress = useProgress();
  const upNext = nextStop(stops, progress);
  const testAfter = new Map(tests.filter((test) => test.id !== "all").map((test) => [test.situations.at(-1)!, test]));
  const whole = tests.find((test) => test.id === "all");

  return (
    <div className="grid gap-8">
      {upNext && (
        <Link
          href={upNext.href}
          className="flex items-center justify-between gap-4 rounded-3xl bg-ink px-5 py-4 text-paper transition-colors hover:bg-night focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="grid gap-0.5">
            <span className="text-sm text-paper/80">{t("upNext")}</span>
            <span className="font-display text-xl font-semibold">{upNext.title}</span>
          </span>
          <ArrowRight aria-hidden className="size-6 shrink-0 text-dawn rtl:-scale-x-100" />
        </Link>
      )}

      <ol className="relative grid gap-5 ps-12 before:absolute before:inset-y-4 before:start-5 before:w-0.5 before:rounded-full before:bg-[repeating-linear-gradient(to_bottom,var(--hairline)_0_8px,transparent_8px_14px)]">
        {stops.map((stop) => {
          const status = situationStatus(stop, progress);
          const test = testAfter.get(stop.id);
          return (
            <Fragment key={stop.id}>
              <li className="relative">
                <span
                  aria-hidden
                  className={cn("absolute -start-12 top-6 grid size-10 place-items-center rounded-full border-2 font-semibold", MARKER[status])}
                >
                  {status === "mastered" ? <Check className="size-5" /> : status === "practised" ? <Footprints className="size-5" /> : stop.order}
                </span>
                <Link
                  href={stop.href}
                  className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-4 rounded-3xl border border-hairline bg-paper p-3 transition-colors hover:border-dawn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:grid-cols-[7rem_minmax(0,1fr)]"
                >
                  <span className="overflow-hidden rounded-2xl bg-sand">
                    <SituationArt art={stop.art} />
                  </span>
                  <span className="grid gap-1">
                    <span className="font-display text-lg font-semibold">{stop.title}</span>
                    <span className={cn("text-sm", status === "mastered" ? "text-oasis-text" : "text-muted-foreground")}>{t(`status.${status}`)}</span>
                  </span>
                </Link>
              </li>
              {test && <TestStop test={test} label={t("testAfter", { number: test.id })} />}
            </Fragment>
          );
        })}
        {whole && <TestStop test={whole} label={t("testAll")} whole />}
      </ol>
    </div>
  );
}

function TestStop({ test, label, whole = false }: { test: TestGroup; label: string; whole?: boolean }) {
  const t = useTranslations("Mawqif");
  const best = useProgress().practice.best[testRoundKey(test.id)];
  return (
    <li className="relative">
      <span
        aria-hidden
        className={cn("absolute -start-12 top-3 grid size-10 place-items-center rounded-full border-2", best ? "border-oasis bg-oasis/15 text-oasis-text" : "border-dawn bg-dawn/15 text-terracotta-text")}
      >
        <Flag className="size-5" />
      </span>
      <Link
        href={`/mawqif/test/${test.id}`}
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-dashed px-4 py-3 font-semibold transition-colors hover:border-dawn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          whole ? "border-dawn bg-dawn/8" : "border-hairline",
        )}
      >
        <span>{label}</span>
        <span className="text-sm font-normal text-muted-foreground">
          {best ? t("testBest", { percent: Math.round(ratio(best) * 100) }) : t("testCount", { count: test.situations.length })}
        </span>
      </Link>
    </li>
  );
}
