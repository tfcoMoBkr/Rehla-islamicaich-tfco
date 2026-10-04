// Fetches the lesson source books from IslamHouse.com, verbatim, for scripts/fetch-content.mjs.
//
// Arabic books carry their text as HTML, one anchored section per heading (t1, t2, …); each
// section is saved as it stands. English books are PDF only: the PDF is kept in content/sources/
// (git-ignored), its text is split at the headings its own table of contents lists, and when a
// heading cannot be found exactly where the table says, the book is saved page by page instead.
// The illustrated guide's pictures are saved to content/media/ with their credit and licence.
//
// PDFs are read by scripts/pdf_tools.py through uv (https://docs.astral.sh/uv/).

import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const API = "https://api3.islamhouse.com/v3";
/** IslamHouse answers 429 to bursts, so requests go one at a time with a pause between them. */
const PAUSE_MS = 1500;
const MAX_TRIES = 5;

const BOOKS = [
  { id: 1871, language: "ar" },
  { id: 62675, language: "ar" },
  { id: 2842316, language: "en" },
  { id: 1261, language: "en" },
];

const GUIDES = [
  {
    id: 2839339,
    language: "en",
    folder: "wudu-guide",
    credit: "Osoul Center via IslamHouse.com",
    licence: "IslamHouse: free reuse with attribution, unmodified",
  },
];

const run = promisify(execFile);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The book's public page; the API URL carries the key and is never written to disk. */
const pageUrl = (id, language) => `https://islamhouse.com/${language}/books/${id}/`;

let lastRequest = 0;

async function request(url) {
  for (let attempt = 1; ; attempt += 1) {
    await pause(Math.max(0, lastRequest + PAUSE_MS - Date.now()));
    lastRequest = Date.now();
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (response.status !== 429 || attempt === MAX_TRIES) {
      if (!response.ok) throw new Error(`IslamHouse answered ${response.status} for ${url.replace(/\/v3\/[^/]+\//, "/v3/…/")}`);
      return response;
    }
    await response.body?.cancel();
    const wait = Number(response.headers.get("retry-after")) * 1000 || PAUSE_MS * 2 ** attempt;
    console.log(`IslamHouse asked to slow down; waiting ${Math.round(wait / 1000)}s`);
    await pause(wait);
  }
}

const getItem = async (key, id, language) => (await request(`${API}/${key}/main/get-item/${id}/${language}/json`)).json();

async function download(url, file, refresh) {
  if (!refresh) {
    try {
      await readFile(file);
      return;
    } catch {}
  }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await (await request(url)).arrayBuffer()));
}

async function pdfTools(root, ...args) {
  const script = path.join(root, "scripts", "pdf_tools.py");
  const { stdout } = await run("uv", ["run", "--no-project", "--with", "pypdf", "--with", "pillow", "python", script, ...args], {
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

const authors = (item) => item.prepared_by.map((person) => ({ name: person.title, role: person.kind }));

/* Arabic books: sections of the HTML text. */

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** The text a browser shows for an HTML fragment: tags removed, whitespace collapsed as HTML does, characters untouched. */
function htmlText(html) {
  return html
    .split(/<br\b[^>]*>/i)
    .map((line) =>
      line
        .replace(/<[^>]+>/g, "")
        .replace(/[ \t\n\f\r]+/g, " ")
        .trim()
        .replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, name) =>
          name[0] === "#"
            ? String.fromCodePoint(name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1)))
            : (ENTITIES[name.toLowerCase()] ?? entity),
        ),
    )
    .join("\n")
    .trim();
}

/** Splits the book's HTML into its anchored sections; the paragraphs after <hr> are its footnotes. */
function htmlSections(html) {
  const sections = [];
  const footnotes = new Map();
  let inFootnotes = false;
  for (const block of html.matchAll(/<(h[1-6]|p)\b([^>]*)>([\s\S]*?)<\/\1>|<hr\b[^>]*>/gi)) {
    const [, tag, attributes, inner] = block;
    if (!tag) {
      inFootnotes = true;
      continue;
    }
    const text = htmlText(inner);
    if (inFootnotes) {
      const note = /id="note_(\d+)"/.exec(inner);
      if (note) footnotes.set(Number(note[1]), text);
      continue;
    }
    const anchor = /<a id="(t\d+)" class="anchor"/.exec(inner)?.[1];
    if (tag[0].toLowerCase() === "h" && anchor) {
      sections.push({ anchor, level: Number(tag[1]), heading: text, paragraphs: [] });
      continue;
    }
    const section = sections.at(-1);
    if (!section) throw new Error("Text before the first anchored heading");
    if (!text) continue;
    const notes = [...inner.matchAll(/id="ref_(\d+)"/g)].map((match) => Number(match[1]));
    section.paragraphs.push({
      index: section.paragraphs.length + 1,
      id: /\bid="(p\d+)"/.exec(attributes)?.[1] ?? null,
      text,
      ...(notes.length ? { notes } : {}),
    });
  }
  for (const section of sections) {
    const numbers = section.paragraphs.flatMap((paragraph) => paragraph.notes ?? []);
    section.footnotes = numbers.map((number) => ({ number, text: footnotes.get(number) ?? null }));
  }
  return sections;
}

/* English books: the text of their PDFs. */

const squash = (text) => text.replace(/\s+/g, " ").trim();
const before = (a, b) => a.page < b.page || (a.page === b.page && a.line < b.line);
const TOC_ENTRY = /^(.*?)\s*\.{4,}\s*(\d+)\s*$/;
const PAGE_NUMBER = /^\s*\d+\s*$/;
const FOOTNOTE = /^\s{0,2}\d{1,3}\s+\S/;
/** Arabic in these PDFs extracts with its letters out of order; ﷺ alone does not count. */
const PDF_ARABIC = /[\u0621-\u064a]/g;
const indent = (line) => line.length - line.trimStart().length;

/** Text from a PDF whose fonts carry no character map comes out as symbols; such a PDF cannot be read. */
function readable(pages) {
  const text = pages.map((page) => page.text).join("").replace(/\s/g, "");
  return text.length > 0 && (text.match(/\p{L}/gu) ?? []).length / text.length > 0.6;
}

/** The page number printed at the top or the foot of a page. */
function printedNumber(lines) {
  const filled = lines.filter((line) => line.trim());
  const number = [filled[0], filled.at(-1)].find((line) => line && PAGE_NUMBER.test(line));
  return number ? Number(number) : null;
}

/** A laid-out page: its body lines, then the footnotes printed under them, without the page number. */
function layoutPage({ page, layout }) {
  const all = layout.split("\n");
  const lines = [...all];
  const trim = () => {
    while (lines.length && (!lines.at(-1).trim() || PAGE_NUMBER.test(lines.at(-1)))) lines.pop();
  };
  trim();
  const noteLines = [];
  for (;;) {
    const gap = lines.findLastIndex((line) => !line.trim());
    if (gap < 0 || !FOOTNOTE.test(lines[gap + 1])) break;
    noteLines.unshift(...lines.splice(gap + 1));
    trim();
  }
  const footnotes = [];
  for (const line of noteLines.filter((candidate) => candidate.trim())) {
    if (FOOTNOTE.test(line) || footnotes.length === 0) footnotes.push({ page, text: squash(line) });
    else footnotes.at(-1).text += ` ${squash(line)}`;
  }
  // A page's text may sit a space or two in from the edge; indents are measured from its usual margin.
  const counts = new Map();
  for (const line of lines.filter((candidate) => candidate.trim())) counts.set(indent(line), (counts.get(indent(line)) ?? 0) + 1);
  const margin = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  return { page, printed: printedNumber(all), lines, footnotes, margin };
}

/** The entries of the PDF's own table of contents, with the printed page of each. */
function tableOfContents(pages) {
  const tocPages = pages.filter((page) => page.lines.filter((line) => TOC_ENTRY.test(line)).length >= 3);
  const entries = [];
  for (const page of tocPages) {
    let pending = [];
    for (const line of page.lines) {
      const entry = TOC_ENTRY.exec(line);
      if (entry) {
        entries.push({ title: squash([...pending, entry[1]].join(" ")), printed: Number(entry[2]) });
        pending = [];
      } else if (line.trim() && !/^(index|contents|table of contents)$/i.test(line.trim())) {
        pending.push(line);
      }
    }
  }
  return { entries, tocPages: tocPages.map((page) => page.page) };
}

/** Where a heading stands on the page its table of contents names: one exact match, or none. */
function findHeading(page, title) {
  const hits = [];
  page.lines.forEach((line, start) => {
    if (!line.trim()) return;
    for (let end = start; end < Math.min(start + 4, page.lines.length); end += 1) {
      const joined = squash(page.lines.slice(start, end + 1).join(" "));
      if (joined === title) hits.push({ page: page.page, line: start, after: end + 1 });
      if (!title.startsWith(joined)) break;
    }
  });
  return hits.length === 1 ? hits[0] : null;
}

/**
 * The paragraphs between two positions. A paragraph opens on an indented line or after a blank
 * one; a page that starts unindented continues the paragraph the previous page ended. Each line's
 * spacing is collapsed and wrapped lines are joined with a space; letters and punctuation are as extracted.
 */
function paragraphsBetween(pages, from, to) {
  const paragraphs = [];
  const footnotes = [];
  for (const page of pages) {
    if (page.page < from.page || page.page > to.page) continue;
    const start = page.page === from.page ? from.line : 0;
    const end = page.page === to.page ? to.line : page.lines.length;
    let gap = false;
    for (const line of page.lines.slice(start, end)) {
      if (!line.trim()) {
        gap = true;
        continue;
      }
      const last = paragraphs.at(-1);
      if (!last || gap || indent(line) >= page.margin + 2) {
        paragraphs.push({ index: paragraphs.length + 1, pages: [page.page], text: squash(line) });
      } else {
        last.text += ` ${squash(line)}`;
        if (!last.pages.includes(page.page)) last.pages.push(page.page);
      }
      gap = false;
    }
    if (end > start) footnotes.push(...page.footnotes);
  }
  for (const paragraph of paragraphs) {
    if ((paragraph.text.match(PDF_ARABIC) ?? []).length >= 5) paragraph.arabicFromPdf = true;
  }
  return { paragraphs, footnotes };
}

function pdfSections(rawPages) {
  if (!readable(rawPages)) return { split: "unreadable", sections: [], unmatched: [] };

  const pages = rawPages.map(layoutPage);
  const { entries, tocPages } = tableOfContents(pages);
  const byPrinted = new Map(pages.filter((page) => !tocPages.includes(page.page)).map((page) => [page.printed, page]));
  const found = entries.map((entry) => ({ entry, at: byPrinted.has(entry.printed) ? findHeading(byPrinted.get(entry.printed), entry.title) : null }));
  const unmatched = found.filter(({ at }) => !at).map(({ entry }) => `${entry.title} (printed page ${entry.printed})`);

  if (entries.length > 0 && unmatched.length === 0 && found.every(({ at }, i) => i === 0 || before(found[i - 1].at, at))) {
    const lastBody = Math.min(...tocPages.filter((page) => page > found.at(-1).at.page), pages.length + 1) - 1;
    const sections = found.map(({ entry, at }, i) => ({
      anchor: `s${i + 1}`,
      heading: entry.title,
      ...paragraphsBetween(pages, { page: at.page, line: at.after }, found[i + 1]?.at ?? { page: lastBody, line: Infinity }),
    }));
    return { split: "headings", sections, unmatched: [] };
  }

  const sections = rawPages
    .filter((page) => page.text.trim())
    .map((page) => ({
      anchor: `page-${String(page.page).padStart(2, "0")}`,
      heading: null,
      paragraphs: [{ index: 1, pages: [page.page], text: page.text.trim() }],
    }));
  return { split: "pages", sections, unmatched: entries.length ? unmatched : ["The PDF has no table of contents to take headings from"] };
}

/* Saving. */

/** How each kind of text was taken from its source, recorded in the book's index. */
const TEXT_RULES = {
  html: "HTML tags removed and whitespace collapsed as a browser shows it; characters as published.",
  headings:
    "Laid-out PDF text: each line's spacing collapsed and wrapped lines joined with a space; letters and punctuation as extracted. " +
    "Paragraphs marked arabicFromPdf hold Arabic whose letter order the PDF does not preserve: take any verse or hadith from its own source.",
  pages: "Each page's text exactly as extracted. Its headings could not be matched, so the book is not split into sections.",
  unreadable: "The PDF's fonts carry no character map, so its text cannot be extracted. Nothing was saved from it.",
};

async function saveBook(dir, book, item, url, today, parts) {
  await rm(dir, { recursive: true, force: true });
  const index = { id: book.id, language: book.language, title: item.title, authors: authors(item), url, fetchedOn: today, parts: [] };
  for (const part of parts) {
    for (const section of part.sections) {
      const anchor = `${part.prefix}${section.anchor}`;
      await writeJson(path.join(dir, `${anchor}.json`), {
        book: book.id,
        language: book.language,
        anchor,
        ...(section.level ? { level: section.level } : {}),
        heading: section.heading,
        paragraphs: section.paragraphs,
        ...(section.footnotes?.length ? { footnotes: section.footnotes } : {}),
        source: { publisher: "IslamHouse.com", title: item.title, url, ...(part.attachment ? { attachment: part.attachment } : {}), fetchedOn: today },
      });
    }
    index.parts.push({
      format: part.format,
      ...(part.attachment ? { attachment: part.attachment, file: part.file, split: part.split } : {}),
      text: TEXT_RULES[part.split ?? part.format],
      ...(part.unmatched?.length ? { unmatchedHeadings: part.unmatched } : {}),
      sections: part.sections.map((section) => ({
        anchor: `${part.prefix}${section.anchor}`,
        heading: section.heading,
        paragraphs: section.paragraphs.length,
      })),
    });
  }
  await writeJson(path.join(dir, "index.json"), index);
  return index;
}

async function writeJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

async function fetchBook(key, book, { root, today, refresh }) {
  const dir = path.join(root, "content", "fetched", "books", String(book.id));
  if (!refresh) {
    try {
      return JSON.parse(await readFile(path.join(dir, "index.json"), "utf8"));
    } catch {}
  }
  const item = await getItem(key, book.id, book.language);
  const url = pageUrl(book.id, book.language);

  if (item.full_description) {
    return saveBook(dir, book, item, url, today, [{ format: "html", prefix: "", sections: htmlSections(item.full_description) }]);
  }

  const parts = [];
  for (const [i, attachment] of item.attachments.entries()) {
    if (attachment.extension_type !== "PDF") continue;
    const file = path.join("content", "sources", `${book.id}-${path.basename(new URL(attachment.url).pathname)}`);
    await download(attachment.url, path.join(root, file), refresh);
    const { split, sections, unmatched } = pdfSections(await pdfTools(root, "text", path.join(root, file)));
    parts.push({
      format: "pdf",
      prefix: item.attachments.length > 1 ? `a${i + 1}-` : "",
      attachment: attachment.url,
      file: file.replaceAll(path.sep, "/"),
      split,
      unmatched,
      sections,
    });
  }
  return saveBook(dir, book, item, url, today, parts);
}

async function fetchGuide(key, guide, { root, refresh }) {
  const mediaDir = path.join(root, "content", "media");
  const manifestFile = path.join(mediaDir, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  const prefix = `${guide.folder}/`;
  const existing = manifest.images.filter((image) => image.src.startsWith(prefix));
  if (!refresh && existing.length > 0) return { saved: existing.length, skipped: [] };

  const item = await getItem(key, guide.id, guide.language);
  const attachment = item.attachments.find((candidate) => candidate.extension_type === "PDF");
  if (!attachment) throw new Error(`IslamHouse item ${guide.id} has no PDF`);
  const file = path.join(root, "content", "sources", `${guide.id}-${path.basename(new URL(attachment.url).pathname)}`);
  await download(attachment.url, file, refresh);

  const outDir = path.join(mediaDir, guide.folder);
  await rm(outDir, { recursive: true, force: true });
  const { saved, skipped } = await pdfTools(root, "images", file, outDir);
  const sourceUrl = pageUrl(guide.id, guide.language);
  manifest.images = [
    ...manifest.images.filter((image) => !image.src.startsWith(prefix)),
    ...saved.map((image) => ({ src: `${prefix}${image.file}`, credit: guide.credit, sourceUrl, licence: guide.licence })),
  ];
  await writeJson(manifestFile, manifest);
  return { saved: saved.length, skipped };
}

/** Fetches every book and guide; returns what was saved, for the report. */
export async function fetchIslamHouse(options) {
  const key = process.env.ISLAMHOUSE_API_KEY;
  if (!key) {
    console.log("ISLAMHOUSE_API_KEY is not set: IslamHouse books skipped.");
    return;
  }
  for (const book of BOOKS) {
    const index = await fetchBook(key, book, options);
    for (const part of index.parts) {
      const how = part.format === "html" ? "HTML sections" : `${part.split}, ${part.file}`;
      console.log(`Book ${book.id} (${book.language}) ${how}: ${part.sections.length} sections`);
      for (const section of part.sections) console.log(`  ${section.anchor}  ${section.paragraphs} paragraphs  ${section.heading ?? ""}`);
      for (const heading of part.unmatchedHeadings ?? []) console.log(`  unmatched heading: ${heading}`);
    }
  }
  for (const guide of GUIDES) {
    const { saved, skipped } = await fetchGuide(key, guide, options);
    console.log(`Guide ${guide.id}: ${saved} images in content/media/${guide.folder}/, ${skipped.length} skipped`);
    for (const image of skipped) console.log(`  skipped page ${image.page} image ${image.index}: ${image.reason}`);
  }
}
