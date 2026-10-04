import { useLocale, useTranslations } from "next-intl";

import type { FiqhNoteView, PublishedTranslation, Wording } from "@/lib/learn/types";

/** The label on text the Rehla team worded itself, because no approved book states it. */
export function TeamWordingLabel({ wording }: { wording: Wording }) {
  const t = useTranslations("Lesson");
  if (wording !== "team") return null;
  return (
    <p className="justify-self-start rounded-full border border-hairline bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
      {t("teamWording")}
    </p>
  );
}

/** A QuranEnc translation or tafsir named with its version, as its publisher asks. */
export function PublishedName({ published }: { published: PublishedTranslation }) {
  const t = useTranslations("Lesson");
  return (
    <>
      {published.version
        ? t("publishedVersion", { name: published.name, version: published.version })
        : t("publishedNoVersion", { name: published.name })}
    </>
  );
}

/**
 * The fixed line under a fiqh lesson's title: the books it follows, and the fiqh encyclopedia
 * sections where scholars' views on its details are set out.
 */
export function FiqhNote({ note }: { note: FiqhNoteView }) {
  const t = useTranslations("Lesson");
  const locale = useLocale();
  const [first, ...more] = note.links;
  const link = (chunks: React.ReactNode) => (
    <a href={first} target="_blank" rel="noreferrer" className="underline underline-offset-4">
      {chunks}
    </a>
  );
  const books = new Intl.ListFormat(locale, { type: "conjunction" }).format(note.books);
  return (
    <p role="note" className="rounded-xl border-s-4 border-dawn bg-dawn/8 px-4 py-3 text-sm leading-relaxed">
      {note.books.length > 0 ? t.rich("fiqhNote", { books, link }) : t.rich("fiqhNoteNoBooks", { link })}
      {more.map((href, index) => (
        <a key={href} href={href} target="_blank" rel="noreferrer" className="ms-2 underline underline-offset-4">
          {t("fiqhSection", { n: index + 2 })}
        </a>
      ))}
    </p>
  );
}
