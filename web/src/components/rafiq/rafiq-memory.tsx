"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";

import { useReferralCentres } from "@/components/specialists/centres-context";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { useProgress } from "@/lib/learn/progress-store";
import { useChosenCity } from "@/lib/referral/chosen-city";
import { useAccount } from "@/lib/account/session";
import { forgetEverything, nameAsked, nameUnused, NAME_MAX_LENGTH } from "@/lib/rafiq/memory";
import { removeLearnerName, saveLearnerName, useAsksForName, useLearnerName } from "@/lib/rafiq/name";
import { shown } from "@/lib/referral/centres";

/** A lesson on the road, in order, as the page hands it to the conversation. */
export type RoadLesson = { id: string; title: string; href: `/${string}` };

/** The first lesson on the road the learner has not completed, from progress kept on the device. */
function useNextLesson(road: readonly RoadLesson[]): RoadLesson | null {
  const { completedLessons } = useProgress();
  return road.find((lesson) => !(lesson.id in completedLessons)) ?? null;
}

/**
 * The greeting and the next step, built from the message files with what the learner gave or did:
 * the name they chose, and the lessons they completed. Nothing here is written by a model.
 */
export function RafiqWelcome({ road, returning }: { road: readonly RoadLesson[]; returning: boolean }) {
  const t = useTranslations("Rafiq");
  const name = useLearnerName();
  const next = useNextLesson(road);
  const greeting = name ? (returning ? t("greetingName", { name }) : t("helloName", { name })) : returning ? t("greeting") : null;

  return (
    <div className="grid gap-2">
      {greeting && <p className="font-display text-xl font-semibold">{greeting}</p>}
      {next ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{t("continueLesson", { number: next.id, title: next.title })}</span>
          <Link href={next.href} className="font-semibold underline underline-offset-4">
            {t("continueAction")}
          </Link>
        </p>
      ) : (
        <p>{t("allDone")}</p>
      )}
    </div>
  );
}

/**
 * Asked once, and skippable, of a guest with no name yet: the name stays on the device and is never
 * sent anywhere. A signed-in learner is called by their account's name and is not asked.
 */
export function NamePrompt() {
  const t = useTranslations("Rafiq");
  const locale = useLocale() as "ar" | "en";
  const asks = useAsksForName();
  const inputId = useId();
  const helpId = useId();
  const [value, setValue] = useState("");

  if (!asks) return null;

  function save(event: FormEvent) {
    event.preventDefault();
    const name = value.trim().slice(0, NAME_MAX_LENGTH);
    if (name) void saveLearnerName(name, locale);
    else nameAsked.set("yes");
  }

  return (
    <form onSubmit={save} className="grid gap-2 rounded-2xl border border-dawn/40 bg-dawn/8 px-5 py-4">
      <label htmlFor={inputId} className="font-semibold">
        {t("nameTitle")}
      </label>
      <p id={helpId} className="text-sm text-muted-foreground">
        {t("nameHelp")}
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          id={inputId}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="off"
          aria-describedby={helpId}
          placeholder={t("nameLabel")}
          dir="auto"
          className="min-h-11 min-w-0 flex-1 rounded-xl border-2 border-border bg-card px-3"
        />
        <Button type="submit" disabled={!value.trim()}>
          {t("nameSave")}
        </Button>
        <Button type="button" variant="outline" onClick={() => nameAsked.set("yes")}>
          {t("nameSkip")}
        </Button>
      </div>
    </form>
  );
}

/** "What Rafiq remembers": everything he keeps, all on this device, with a way to change or clear it. */
export function RafiqMemory({
  road,
  messages,
  onCleared,
}: {
  road: readonly RoadLesson[];
  messages: number;
  onCleared: () => void;
}) {
  const t = useTranslations("Rafiq");
  const locale = useLocale() as "ar" | "en";
  const name = useLearnerName();
  const account = useAccount();
  const unused = nameUnused.use() !== null;
  const city = useChosenCity();
  const { centers } = useReferralCentres();
  const { completedLessons } = useProgress();
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const inputId = useId();

  const reached = road.filter((lesson) => lesson.id in completedLessons).at(-1);
  const cityName = city ? centers.find((centre) => centre.city.ar === city)?.city : undefined;

  async function rename(event: FormEvent) {
    event.preventDefault();
    const value = draft.trim().slice(0, NAME_MAX_LENGTH);
    if (!value) {
      removeLearnerName();
      setEditing(false);
      return;
    }
    const saved = await saveLearnerName(value, locale);
    setAnnouncement(saved ? "" : t("nameSaveFailed"));
    if (saved) setEditing(false);
  }

  return (
    <details className="group rounded-2xl border border-hairline bg-paper px-5 py-3">
      <summary className="cursor-pointer py-1 font-semibold">{t("memoryTitle")}</summary>
      <div className="mt-3 grid gap-3">
        <ul className="grid gap-1.5 text-sm">
          <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              {name
                ? t(account ? "memoryNameAccount" : "memoryName", { name })
                : account && unused
                  ? t("memoryNameUnused")
                  : t("memoryNoName")}
            </span>
            {!editing && (
              <button
                type="button"
                className="underline underline-offset-4"
                onClick={() => {
                  setDraft(name ?? account?.name ?? "");
                  setEditing(true);
                }}
              >
                {t("editName")}
              </button>
            )}
            {name && !editing && (
              <button type="button" className="underline underline-offset-4" onClick={removeLearnerName}>
                {t("removeName")}
              </button>
            )}
            {account && unused && !editing && (
              <button type="button" className="underline underline-offset-4" onClick={() => nameUnused.set(null)}>
                {t("useNameAgain")}
              </button>
            )}
          </li>
          {editing && (
            <li>
              <form onSubmit={(event) => void rename(event)} className="flex flex-wrap gap-2">
                <label htmlFor={inputId} className="sr-only">
                  {t("nameLabel")}
                </label>
                <input
                  id={inputId}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={NAME_MAX_LENGTH}
                  autoComplete="off"
                  dir="auto"
                  className="min-h-11 min-w-0 flex-1 rounded-xl border-2 border-border bg-card px-3"
                />
                <Button type="submit">{t("nameSave")}</Button>
              </form>
            </li>
          )}
          <li>{reached ? t("memoryPlace", { number: reached.id }) : t("memoryPlaceNone")}</li>
          <li>{t("memoryConversation", { count: messages })}</li>
          <li>
            {cityName ? t("memoryCity", { city: shown(cityName, locale).text }) : t("memoryNoCity")}
          </li>
        </ul>
        <p className="text-sm font-medium">{t("memoryDeviceOnly")}</p>
        <p className="text-sm text-muted-foreground">{t(account ? "memoryNoteAccount" : "memoryNote")}</p>
        <p className="text-sm text-muted-foreground">{t("memoryProgress")}</p>
        <div className="flex flex-wrap gap-2">
          {confirming ? (
            <Button
              variant="destructive"
              onClick={() => {
                forgetEverything();
                onCleared();
                setConfirming(false);
                setAnnouncement(t("cleared"));
              }}
            >
              {t("clearConfirm")}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setConfirming(true)}>
              {t("clearAll")}
            </Button>
          )}
        </div>
        <p role="status" className="text-sm">
          {announcement}
        </p>
      </div>
    </details>
  );
}
