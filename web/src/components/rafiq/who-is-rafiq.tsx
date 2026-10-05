"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { MeetRafiq } from "./meet-rafiq";

/** "Who is Rafiq?": his introduction again, in a dialog that returns focus where it was opened. */
export function WhoIsRafiq({ className }: { className?: string }) {
  const t = useTranslations("MeetRafiq");
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        className={className}
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        {t("who")}
      </button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        aria-labelledby="who-is-rafiq"
        className="tone-day m-auto max-h-[90dvh] w-[min(42rem,calc(100%-1.5rem))] overflow-y-auto rounded-3xl bg-sand p-5 text-foreground backdrop:bg-night/70 sm:p-8"
      >
        <div className="grid gap-4">
          <Button variant="ghost" size="icon" className="justify-self-end" onClick={() => dialog.current?.close()} aria-label={t("close")}>
            <X aria-hidden />
          </Button>
          {open && <MeetRafiq id="who-is-rafiq" layout="intro" />}
        </div>
      </dialog>
    </>
  );
}
