"use client";

import { Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

/** Slightly slower than normal speech, so a new learner can follow each word. */
const PRACTICE_RATE = 0.8;

/** The browser's Arabic voice, once the browser has listed its voices; null when it has none. */
function useArabicVoice(): SpeechSynthesisVoice | null {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const pick = () => setVoice(synth.getVoices().find((option) => option.lang.toLowerCase().startsWith("ar")) ?? null);
    pick();
    synth.addEventListener("voiceschanged", pick);
    return () => synth.removeEventListener("voiceschanged", pick);
  }, []);
  return voice;
}

/**
 * Reads an Arabic phrase aloud with the device's own Arabic voice, for practice. It is a computer
 * voice and is labelled so; it is never offered for a Quran verse, and is hidden when the device has
 * no Arabic voice.
 */
export function ListenButton({ text }: { text: string }) {
  const t = useTranslations("Mawqif");
  const voice = useArabicVoice();
  if (!voice) return null;

  function listen() {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice!.lang;
    utterance.rate = PRACTICE_RATE;
    synth.speak(utterance);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={listen}>
        <Volume2 aria-hidden />
        {t("listen")}
      </Button>
      <span className="text-xs text-muted-foreground">{t("computerVoice")}</span>
    </div>
  );
}
