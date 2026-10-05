"use client";

import { useTranslations } from "next-intl";

import { Lantern } from "@/components/journey/lantern";
import { cn } from "@/lib/utils";

type Shape = "page" | "road" | "board" | "conversation";

function Bar({ className }: { className?: string }) {
  return <span className={cn("block h-4 rounded-full bg-hairline/70", className)} />;
}

/**
 * What a section looks like while it opens: its own shape in sand and hairline, and Rafiq's
 * lantern breathing (still under reduced motion). The header and footer stay in place around it.
 * A client component: a loading boundary renders apart from the layout, so it reads its one
 * message from the layout's client messages rather than from the request.
 */
export function PageLoading({ shape = "page" }: { shape?: Shape }) {
  const t = useTranslations("Common");
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-4xl px-4 pt-20 pb-32 sm:px-6 md:pt-24">
      <span className="sr-only">{t("loading")}</span>
      <div aria-hidden className="grid gap-8">
        <div className="flex items-center gap-4">
          <Lantern state="thinking" className="size-12 shrink-0 text-ink" />
          <div className="grid flex-1 gap-3">
            <Bar className="h-8 w-2/3 max-w-sm bg-hairline" />
            <Bar className="w-5/6 max-w-xl" />
          </div>
        </div>
        {shape === "board" && <div className="tone-board aspect-[4/3] max-h-[28rem] w-full rounded-3xl bg-background sm:aspect-[16/9]" />}
        {shape === "conversation" && (
          <div className="grid gap-5">
            <div className="ms-14 h-28 rounded-2xl rounded-ss-sm border border-hairline bg-paper" />
            <div className="ms-auto h-14 w-2/3 rounded-2xl rounded-se-sm bg-hairline/60" />
            <div className="h-40 rounded-3xl border border-hairline bg-paper" />
          </div>
        )}
        {shape === "road" && (
          <ol className="grid gap-6">
            {[0, 1, 2].map((stop) => (
              <li key={stop} className={cn("flex items-center gap-4", stop % 2 === 1 && "flex-row-reverse")}>
                <span className="size-14 shrink-0 rounded-full border-2 border-dashed border-hairline bg-paper" />
                <span className="h-20 flex-1 rounded-2xl border border-hairline bg-paper" />
              </li>
            ))}
          </ol>
        )}
        {shape === "page" && (
          <div className="grid gap-4 rounded-3xl border border-hairline bg-paper p-6">
            <Bar className="w-1/3" />
            <Bar />
            <Bar className="w-11/12" />
            <Bar className="w-4/5" />
          </div>
        )}
      </div>
    </div>
  );
}
