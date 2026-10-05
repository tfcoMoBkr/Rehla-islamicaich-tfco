"use client";

import { Smartphone, UserRound, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { Lantern } from "@/components/journey/lantern";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { choose, useChoiceOpen } from "@/lib/account/choice";

/**
 * The first time a visitor who is not signed in opens Khutuwat, Practice or Rafiq: an account, or
 * guest use, as two equal choices. A native modal dialog keeps focus inside it and is read as a
 * dialog; Escape counts as continuing as a guest, so it never traps anyone.
 */
export function AccountChoice() {
  const t = useTranslations("AccountChoice");
  const pathname = usePathname();
  const open = useChoiceOpen(pathname);
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) element.showModal();
    if (!open && element?.open) element.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialog}
      aria-labelledby="account-choice-title"
      aria-describedby="account-choice-intro"
      onCancel={(event) => {
        event.preventDefault();
        choose("guest");
      }}
      className="tone-day m-auto w-[min(40rem,calc(100%-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-hairline bg-paper p-0 text-foreground shadow-2xl backdrop:bg-night/70"
    >
      <div className="grid gap-6 p-6 sm:p-8">
        <div className="grid justify-items-center gap-3 text-center">
          <Lantern className="size-12 text-ink" />
          <h2 id="account-choice-title" className="font-display text-3xl font-semibold">
            {t("title")}
          </h2>
          <p id="account-choice-intro" className="max-w-md text-muted-foreground">
            {t("intro")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceCard
            icon={UserRound}
            title={t("createTitle")}
            body={t("createBody")}
            onChoose={() => {
              choose("account");
              router.push("/account/sign-up");
            }}
          />
          <ChoiceCard icon={Smartphone} title={t("guestTitle")} body={t("guestBody")} onChoose={() => choose("guest")} />
        </div>
        <p className="text-center text-sm">
          {t("haveAccount")}{" "}
          <Link href="/account/sign-in" onClick={() => choose("account")} className="font-semibold underline underline-offset-4">
            {t("signIn")}
          </Link>
        </p>
      </div>
    </dialog>
  );
}

function ChoiceCard({ icon: Icon, title, body, onChoose }: { icon: LucideIcon; title: string; body: string; onChoose: () => void }) {
  return (
    <button
      type="button"
      onClick={onChoose}
      className="grid min-h-36 content-start gap-2 rounded-2xl border-2 border-hairline bg-sand p-5 text-start transition-colors hover:border-dawn hover:bg-dawn/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="flex items-center gap-2 font-display text-xl font-semibold">
        <Icon aria-hidden className="size-5 shrink-0 text-terracotta-text" />
        {title}
      </span>
      <span className="leading-relaxed text-muted-foreground">{body}</span>
    </button>
  );
}
