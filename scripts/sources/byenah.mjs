// byenah.com: "New Muslim Guideline" (Muhammad al-Shehri), English. The DOCX is read and split at
// its own headings; the PDF is kept beside it in content/sources/ for reference.

import path from "node:path";

import { corpusDir, download, exists, python, readJson, scriptPath, sectionCharacters, sourcesDir, today, writeJson } from "./common.mjs";

const BOOK = {
  id: "byenah-4784",
  language: "en",
  title: "New Muslim Guideline",
  author: "Muhammad al-Shehri",
  publisher: "byenah.com",
  url: "https://byenah.com/en/muslim-content/4784",
  docx: "https://cdn.byenah.com/contents/4784/en-injlis-amuf-lilmu-aljad-ww.docx",
  pdf: "https://cdn.byenah.com/contents/4784/en-injlis-amuf-lilmu-aljad-pp.pdf",
};

const local = (url) => path.join(sourcesDir, `${BOOK.id}-${path.basename(new URL(url).pathname)}`);

export async function fetchByenah({ refresh }) {
  const dir = path.join(corpusDir, "books", BOOK.id);
  if (!refresh && (await exists(path.join(dir, "index.json")))) {
    const index = await readJson(path.join(dir, "index.json"));
    return { id: BOOK.id, sections: index.sections, failures: [] };
  }
  const failures = [];
  let docx;
  try {
    docx = await download(BOOK.docx, local(BOOK.docx), { refresh });
    await download(BOOK.pdf, local(BOOK.pdf), { refresh });
  } catch (error) {
    // A 403 means the files must be downloaded by hand into content/sources/.
    return { id: BOOK.id, sections: [], failures: [`${error.message}${error.status === 403 ? " (download the files by hand)" : ""}`] };
  }

  const found = await python(scriptPath("sources", "docx_sections.py"), ["python-docx"], docx);
  // A heading followed only by pictures (the book's "Summary") has no text to keep: it is listed, not saved.
  const headingsWithoutText = found.filter((section) => section.paragraphs.length === 0).map((section) => section.heading);
  const sections = found
    .filter((section) => section.paragraphs.length > 0)
    .map((section, index) => ({ anchor: `s${index + 1}`, ...section }));
  const source = { publisher: BOOK.publisher, title: BOOK.title, url: BOOK.url, file: BOOK.docx, fetchedOn: today };

  for (const [index, section] of sections.entries()) {
    await writeJson(path.join(dir, `${index + 1}.json`), {
      book: BOOK.id,
      language: BOOK.language,
      anchor: section.anchor,
      level: section.level,
      heading: section.heading,
      paragraphs: section.paragraphs,
      source,
    });
  }
  await writeJson(path.join(dir, "index.json"), {
    id: BOOK.id,
    language: BOOK.language,
    title: BOOK.title,
    authors: [{ name: BOOK.author, role: "author" }],
    url: BOOK.url,
    fetchedOn: today,
    format: "docx",
    text: "Each paragraph exactly as the DOCX has it, with the name of its style (the book sets Quran verses in its own style). Split at the book's Title, Heading 1 and Heading 2 paragraphs; empty paragraphs are skipped.",
    ...(headingsWithoutText.length ? { headingsWithoutText } : {}),
    sections: sections.map((section, index) => ({
      file: `${index + 1}.json`,
      anchor: section.anchor,
      level: section.level,
      heading: section.heading,
      paragraphs: section.paragraphs.length,
      characters: sectionCharacters(section),
    })),
  });
  return { id: BOOK.id, sections, failures };
}
