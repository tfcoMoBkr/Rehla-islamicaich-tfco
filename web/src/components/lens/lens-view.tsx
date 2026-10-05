"use client";

import { Camera, ImageUp, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import type { LessonLink } from "@/components/rafiq/answer-view";
import { CALLIGRAPHY_WORD, EXAMPLES, exampleSeen, type ExampleId } from "@/lib/lens/examples";
import { readLens, type LensRequest, type LensResponse, type LensResult as LensReply, type SeenInput } from "@/lib/lens/lens";
import { preparePhoto } from "@/lib/lens/photo";
import { useProgress } from "@/lib/learn/progress-store";

import { ExampleArt } from "./example-art";
import { LensCard } from "./lens-card";
import { LensResult } from "./lens-result";
import { LensWorking } from "./lens-working";

/** Where the reading step usually ends; the second step is shown from then on. */
const READING_MS = 2500;

type Picture = { kind: "photo"; src: string } | { kind: "example"; id: ExampleId };
type Problem = "type" | "size" | "rateLimited" | "unavailable" | "error";
type State =
  | { kind: "idle"; problem?: Problem }
  | { kind: "working"; picture: Picture; step: 0 | 1 }
  | { kind: "done"; picture: Picture; response: LensResponse };

const PROBLEM: Record<Exclude<LensReply["kind"], "result">, Problem> = {
  rateLimited: "rateLimited",
  unavailable: "unavailable",
  tooLarge: "size",
  badType: "type",
  error: "error",
};

/**
 * Lens: take or choose a photo, or tap an example. The photo is prepared in the browser (checked,
 * downscaled, re-encoded without its metadata), then read, decided on and explained by the service.
 */
export function LensView({ lessons }: { lessons: Readonly<Record<string, LessonLink>> }) {
  const t = useTranslations("Lens");
  const locale = useLocale() as "ar" | "en";
  const { completedLessons } = useProgress();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [announcement, setAnnouncement] = useState("");
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const pending = useRef<AbortController | null>(null);
  const heading = useRef<HTMLDivElement>(null);

  useEffect(() => () => pending.current?.abort(), []);

  useEffect(() => {
    if (state.kind === "done") heading.current?.querySelector<HTMLElement>("h2")?.focus();
  }, [state.kind]);

  async function run(picture: Picture, request: Omit<LensRequest, "locale" | "reachedLessonIds">) {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const fromExample = picture.kind === "example" || request.seen !== undefined;
    setState({ kind: "working", picture, step: fromExample ? 1 : 0 });
    setAnnouncement(t("working"));
    const timer = fromExample
      ? undefined
      : window.setTimeout(() => setState((current) => (current.kind === "working" ? { ...current, step: 1 } : current)), READING_MS);
    let result: LensReply;
    try {
      result = await readLens({ ...request, locale, reachedLessonIds: Object.keys(completedLessons) }, { signal: controller.signal });
    } catch {
      return;
    } finally {
      window.clearTimeout(timer);
    }
    if (controller.signal.aborted) return;
    if (result.kind !== "result") {
      setState({ kind: "idle", problem: PROBLEM[result.kind] });
      setAnnouncement(t(`errors.${PROBLEM[result.kind]}`));
      return;
    }
    setState({ kind: "done", picture, response: result.response });
    setAnnouncement(t("done"));
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    let prepared: Awaited<ReturnType<typeof preparePhoto>>;
    try {
      prepared = await preparePhoto(file);
    } catch {
      prepared = "type";
    }
    if (typeof prepared === "string") {
      setState({ kind: "idle", problem: prepared });
      setAnnouncement(t(`errors.${prepared}`));
      return;
    }
    void run({ kind: "photo", src: prepared.preview }, { photo: { base64: prepared.base64, mimeType: prepared.mimeType } });
  }

  function chooseOther(subject: string) {
    if (state.kind !== "done" || !state.response.seen) return;
    const seen: SeenInput = { ...state.response.seen, subject, visibleText: null, plainTranslation: null, others: [] };
    void run(state.picture, { seen });
  }

  function retake() {
    pending.current?.abort();
    setState({ kind: "idle" });
    setAnnouncement("");
  }

  const picture = (shown: Picture) =>
    shown.kind === "photo" ? (
      // A data URL made in the browser: next/image has nothing to optimise.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={shown.src} alt={t("photoAlt")} className="max-h-[60vh] w-full object-contain" />
    ) : (
      <figure className="grid gap-2 p-6">
        <ExampleArt id={shown.id} word={CALLIGRAPHY_WORD} className="mx-auto max-w-xs" />
        <figcaption className="justify-self-center rounded-full bg-dawn/15 px-3 py-1 text-sm font-semibold text-terracotta-text">
          {t("exampleBadge")} · {t(`examples.${shown.id}`)}
        </figcaption>
      </figure>
    );

  return (
    <div className="grid gap-8">
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {state.kind === "working" && <LensWorking picture={picture(state.picture)} step={state.step} />}

      {state.kind === "done" && (
        <div ref={heading} className="grid gap-8">
          <div className="overflow-hidden rounded-3xl border border-hairline bg-paper">{picture(state.picture)}</div>
          {state.response.card ? (
            <LensCard card={state.response.card} subject={state.response.seen?.subject} onRetake={retake} />
          ) : (
            <LensResult response={state.response} lessons={lessons} onRetake={retake} onChoose={chooseOther} />
          )}
        </div>
      )}

      {state.kind === "idle" && (
        <>
          <section aria-labelledby="lens-start" className="grid gap-4 rounded-3xl border border-hairline bg-paper p-6 sm:p-8">
            <h2 id="lens-start" className="font-display text-2xl font-semibold">
              {t("startTitle")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => camera.current?.click()} className={ACTION}>
                <Camera aria-hidden className="size-7 text-terracotta-text" />
                {t("takePhoto")}
              </button>
              <button type="button" onClick={() => library.current?.click()} className={ACTION}>
                <ImageUp aria-hidden className="size-7 text-terracotta-text" />
                {t("choosePhoto")}
              </button>
            </div>
            <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(event) => void onFile(event)} />
            <input ref={library} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(event) => void onFile(event)} />
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-oasis-text" />
              {t("privacyLine")}
            </p>
            {state.problem && (
              <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/8 px-4 py-3 font-medium text-destructive">
                {t(`errors.${state.problem}`)}
              </p>
            )}
          </section>

          <section aria-labelledby="lens-examples" className="grid gap-4">
            <div className="grid gap-1">
              <h2 id="lens-examples" className="font-display text-xl font-semibold">
                {t("examplesTitle")}
              </h2>
              <p className="text-muted-foreground">{t("examplesBody")}</p>
            </div>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {EXAMPLES.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => void run({ kind: "example", id }, { seen: exampleSeen(id, locale) })}
                    className="grid h-full w-full content-start gap-2 rounded-2xl border-2 border-hairline bg-paper p-3 text-start transition-colors hover:border-dawn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <ExampleArt id={id} word={CALLIGRAPHY_WORD} className="rounded-xl bg-sand" />
                    <span className="text-xs font-semibold text-terracotta-text">{t("exampleBadge")}</span>
                    <span className="font-medium">{t(`examples.${id}`)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

const ACTION =
  "flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-hairline bg-sand px-4 py-5 text-lg font-semibold transition-colors hover:border-dawn hover:bg-dawn/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
