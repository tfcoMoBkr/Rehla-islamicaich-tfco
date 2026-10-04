// islamhouse.com books for the corpus, through the IslamHouse API (ISLAMHOUSE_API_KEY). Their
// text comes only from each PDF's own text layer: a PDF without one is reported, never OCR'd.
// A book whose contents pages link to its chapters is split at those links; otherwise it is
// saved page by page and the report says so.

import path from "node:path";

import {
  characters,
  corpusDir,
  download,
  exists,
  getJson,
  python,
  readJson,
  root,
  scriptPath,
  sectionCharacters,
  sourcesDir,
  today,
  writeJson,
} from "./common.mjs";

const API = "https://api3.islamhouse.com/v3";

// 2838873/2838874 (Haitham Sarhan's guide) are not used: their PDFs have no text layer.
export const ISLAMHOUSE_BOOKS = [{ id: 2831443, language: "ar" }];

/** Quran verses typeset in a glyph font extract as presentation-form codepoints that spell nothing. */
const GLYPH_FONT = /[ﭐ-ﷹﷻ-﷿ﹰ-﻿]/gu;

const TEXT_RULES = {
  contents:
    "Each page's text exactly as its PDF text layer gives it (one paragraph per page), split at the chapters the book's own contents pages link to; headings are the text inside each contents link, as extracted. Paragraphs marked quranGlyphs hold verses typeset in a glyph font that do not extract as text: take any verse from its own source.",
  pages: "Each page's text exactly as its PDF text layer gives it. The book has no contents links to split at, so it is saved page by page.",
};

const pageUrl = (book) => `https://islamhouse.com/${book.language}/books/${book.id}/`;

/** The entries of the contents pages at the front: links on pages before the first chapter they lead to. */
function leadingContents(entries) {
  const ordered = [...entries].sort((a, b) => a.page - b.page);
  const front = [];
  let firstChapter = Infinity;
  for (const entry of ordered) {
    if (entry.page >= firstChapter) break;
    front.push(entry);
    firstChapter = Math.min(firstChapter, entry.target);
  }
  return front.sort((a, b) => a.target - b.target);
}

const pageParagraph = (page) => {
  const text = page.text.trim();
  const glyphs = (text.match(GLYPH_FONT) ?? []).length;
  return { index: 0, pages: [page.page], text, ...(glyphs >= 3 ? { quranGlyphs: true } : {}) };
};

function splitAtContents(pages, contents) {
  const sections = [];
  const firstChapter = contents[0]?.target ?? Infinity;
  const lastContentsPage = Math.max(...contents.map((entry) => entry.page));
  const span = (from, to, heading, headingFragments) => {
    const paragraphs = pages
      .filter((page) => page.page >= from && page.page <= to && page.text.trim())
      .map(pageParagraph)
      .map((paragraph, index) => ({ ...paragraph, index: index + 1 }));
    if (paragraphs.length > 0) sections.push({ heading, headingFragments, paragraphs });
  };
  span(lastContentsPage + 1, firstChapter - 1, null, []);
  contents.forEach((entry, index) => {
    span(entry.target, (contents[index + 1]?.target ?? pages.length + 1) - 1, entry.title, entry.fragments);
  });
  return sections;
}

async function fetchBook(key, book, refresh) {
  const failures = [];
  const item = await getJson(`${API}/${key}/main/get-item/${book.id}/${book.language}/json`);
  const attachment = (item.attachments ?? []).find((candidate) => candidate.extension_type === "PDF");
  if (!attachment) return { book, item, sections: [], failures: ["no PDF attachment"] };

  const file = path.join(sourcesDir, `${book.id}-${path.basename(new URL(attachment.url).pathname)}`);
  await download(attachment.url, file, { refresh });
  const pages = await python(scriptPath("pdf_tools.py"), ["pypdf", "pillow"], "text", file);
  if (characters(pages.map((page) => page.text.trim())) === 0) {
    return { book, item, file, sections: [], failures: [`${path.basename(file)} has no text layer (its ${pages.length} pages are images); OCR is not used`] };
  }

  const contents = leadingContents(await python(scriptPath("sources", "pdf_contents.py"), ["pypdf"], file));
  let split = "contents";
  let sections = splitAtContents(pages, contents);
  if (contents.length === 0) {
    split = "pages";
    failures.push("no contents links to split at; saved page by page");
    sections = pages.filter((page) => page.text.trim()).map((page) => ({ heading: null, paragraphs: [{ ...pageParagraph(page), index: 1 }] }));
  }
  return { book, item, file, split, sections, failures };
}

async function saveBook({ book, item, file, split, sections, failures }) {
  const id = `islamhouse-${book.id}`;
  const dir = path.join(corpusDir, "books", id);
  const url = pageUrl(book);
  const attachment = (item.attachments ?? []).find((candidate) => candidate.extension_type === "PDF")?.url;
  const source = { publisher: "IslamHouse.com", title: item.title, url, ...(attachment ? { file: attachment } : {}), fetchedOn: today };
  for (const [index, section] of sections.entries()) {
    await writeJson(path.join(dir, `${index + 1}.json`), {
      book: id,
      language: book.language,
      anchor: `s${index + 1}`,
      heading: section.heading,
      ...(section.headingFragments?.length > 1 ? { headingFragments: section.headingFragments } : {}),
      paragraphs: section.paragraphs,
      source,
    });
  }
  await writeJson(path.join(dir, "index.json"), {
    id,
    language: book.language,
    title: item.title,
    authors: (item.prepared_by ?? []).map((person) => ({ name: person.title, role: person.kind })),
    url,
    fetchedOn: today,
    format: "pdf",
    ...(file ? { file: path.relative(root, file).replaceAll(path.sep, "/") } : {}),
    ...(split ? { split, text: TEXT_RULES[split] } : {}),
    failures,
    sections: sections.map((section, index) => ({
      file: `${index + 1}.json`,
      anchor: `s${index + 1}`,
      heading: section.heading,
      paragraphs: section.paragraphs.length,
      characters: sectionCharacters(section),
    })),
  });
  return { id, language: book.language, sections: sections.length, failures };
}

export async function fetchIslamHouseBooks({ refresh }) {
  const key = process.env.ISLAMHOUSE_API_KEY;
  const results = [];
  for (const book of ISLAMHOUSE_BOOKS) {
    const index = path.join(corpusDir, "books", `islamhouse-${book.id}`, "index.json");
    if (!refresh && (await exists(index))) {
      const saved = await readJson(index);
      results.push({ id: saved.id, language: saved.language, sections: saved.sections.length, failures: saved.failures });
      continue;
    }
    // The key is needed only to fetch: books already saved are resumed without it.
    if (!key) {
      results.push({ id: `islamhouse-${book.id}`, sections: 0, failures: ["ISLAMHOUSE_API_KEY is not set"] });
      continue;
    }
    try {
      results.push(await saveBook(await fetchBook(key, book, refresh)));
    } catch (error) {
      results.push({ id: `islamhouse-${book.id}`, sections: 0, failures: [error.message] });
    }
  }
  return results;
}
