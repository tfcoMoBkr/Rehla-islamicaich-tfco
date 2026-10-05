import { Check, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * While Lens works: the photo under a soft scanning light (still under reduced motion), and the two
 * steps it goes through, so the wait reads as progress. An example skips the reading step.
 */
export function LensWorking({ picture, step }: { picture: ReactNode; step: 0 | 1 }) {
  const t = useTranslations("Lens");
  const steps = [t("stepRead"), t("stepSources")];
  return (
    <div className="grid gap-6">
      <div className="relative overflow-hidden rounded-3xl border border-hairline bg-paper">
        {picture}
        <div aria-hidden className="lens-scan pointer-events-none absolute inset-0" />
      </div>
      <ol aria-label={t("working")} className="grid gap-2">
        {steps.map((label, index) => {
          const done = index < step;
          const current = index === step;
          return (
            <li
              key={label}
              aria-current={current ? "step" : undefined}
              className={cn("flex items-center gap-3 text-lg", current ? "font-semibold" : "text-muted-foreground")}
            >
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-full border-2",
                  done ? "border-oasis bg-oasis text-paper" : current ? "border-dawn" : "border-hairline",
                )}
              >
                {done ? (
                  <Check aria-hidden className="size-4" />
                ) : current ? (
                  <LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" />
                ) : (
                  <span className="text-sm">{index + 1}</span>
                )}
              </span>
              {label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
