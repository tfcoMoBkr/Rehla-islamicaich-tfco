"use client";

import { Download, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { deleteAccount, exportData } from "@/lib/account/actions";
import type { AccountError } from "@/lib/account/errors";

import { Field, FormMessage, TextInput } from "./fields";

function saveFile(name: string, data: object): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** "Download my data" and "Delete my account and data", the second behind a typed word. */
export function DataSection({ onDeleted }: { onDeleted: () => void }) {
  const t = useTranslations("Account");
  const [error, setError] = useState<AccountError | "confirmWord" | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState<"download" | "delete" | null>(null);
  const word = t("deleteWord");

  async function download() {
    setBusy("download");
    setError(null);
    const result = await exportData();
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    saveFile(`rehla-my-data-${new Date().toISOString().slice(0, 10)}.json`, result.data);
    setDownloaded(true);
  }

  async function remove(event: FormEvent) {
    event.preventDefault();
    if (typed.trim().toLowerCase() !== word.toLowerCase()) {
      setError("confirmWord");
      return;
    }
    setBusy("delete");
    setError(null);
    const result = await deleteAccount();
    setBusy(null);
    if (result.ok) onDeleted();
    else setError(result.error);
  }

  return (
    <section aria-labelledby="account-data" className="grid gap-4">
      <h2 id="account-data" className="font-display text-2xl font-semibold">
        {t("dataTitle")}
      </h2>
      <p className="text-muted-foreground">{t("dataBody")}</p>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={download} disabled={busy !== null}>
          <Download aria-hidden />
          {busy === "download" ? t("working") : t("download")}
        </Button>
        {!confirming && (
          <Button
            variant="outline"
            className="border-destructive/50 text-destructive hover:border-destructive"
            onClick={() => {
              setConfirming(true);
              setDownloaded(false);
            }}
          >
            <Trash2 aria-hidden />
            {t("delete")}
          </Button>
        )}
      </div>
      {downloaded && <FormMessage tone="done">{t("downloaded")}</FormMessage>}
      {error && error !== "confirmWord" && <FormMessage tone="error">{t(`errors.${error}`)}</FormMessage>}

      {confirming && (
        <form onSubmit={remove} noValidate className="grid gap-4 rounded-2xl border-2 border-destructive/40 bg-paper p-5">
          <p className="font-semibold">{t("deleteWarning")}</p>
          <Field label={t("deletePrompt", { word })} error={error === "confirmWord" ? t("errors.confirmWord") : null}>
            {(props) => <TextInput {...props} autoComplete="off" value={typed} onChange={(event) => setTyped(event.target.value)} />}
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="destructive" disabled={busy !== null}>
              {busy === "delete" ? t("working") : t("deleteConfirm")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setConfirming(false);
                setTyped("");
                setError(null);
              }}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
