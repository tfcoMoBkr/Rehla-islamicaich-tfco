// dawa.center books for the corpus. Their text comes only from each PDF's own text layer, split
// into one section per question by scripts/sources/qa_sections.py: a question-and-answer book is
// indexed one question with its summary answer per chunk (ai/app/ingest.py).

import path from "node:path";

import { corpusDir, exists, getText, python, readJson, root, scriptPath, sectionCharacters, sourcesDir, today, writeJson } from "./common.mjs";

export const DAWA_BOOKS = [{ id: 7937, language: "ar" }];

const pageUrl = (book) => `https://dawa.center/file/${book.id}`;

const TEXT_RULE =
  "One section per question, from its numbered heading to the next. Each paragraph is one of the book's own parts of the question (question, similar, content, summary, detail, closing, related, keywords; lead is any text before the first label), its lines exactly as the PDF text layer gives them, without the running heads and page numbers. The headings and labels are set in a font that partly extracts out of order: they are recognised, not kept. Paragraphs marked glyphs hold Quran verses in a private-use glyph font that do not extract as text: take any verse from its own source.";

/** The page's title and the address of its PDF, as the page gives them. */
function readPage(html) {
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1]?.trim() ?? "";
  const file = /href="(https:\/\/dawa\.center\/storage\/files\/[^"]+\.pdf)"/.exec(html)?.[1];
  const fact = (name) => new RegExp(`<dt>${name}</dt><dd>([^<]+)</dd>`).exec(html)?.[1]?.trim();
  // The only rights wording the page publishes is its footer.
  const rights = /©[^<]{0,80}/.exec(html)?.[0]?.trim();
  return { title, file, author: fact("المؤلف"), publisher: fact("الناشر"), year: fact("سنة النشر"), rights };
}

async function fetchBook(book, refresh) {
  const html = await getText(pageUrl(book), { gapMs: 2000 });
  const page = readPage(html);
  if (!page.file) return { book, page, sections: [], failures: ["the page links no PDF"] };
  const file = path.join(sourcesDir, `dawa-${book.id}-${path.basename(new URL(page.file).pathname)}`);
  // dawa.center's robots.txt disallows /storage/files/, where the PDF is: the script never fetches
  // it. The PDF is downloaded by hand from the book's public page and saved under this name.
  if (!(await exists(file))) {
    return { book, page, sections: [], failures: [`download ${page.file} by hand from ${pageUrl(book)} and save it as ${file}`] };
  }
  const split = await python(scriptPath("sources", "qa_sections.py"), ["pypdf"], file);
  const failures = [];
  if (split.sections.length === 0) failures.push(`${path.basename(file)}: no numbered questions found in its text layer`);
  const numbers = split.sections.map((section) => section.number);
  const missing = numbers.length ? [...Array(Math.max(...numbers)).keys()].map((n) => n + 1).filter((n) => !numbers.includes(n)) : [];
  if (missing.length) failures.push(`questions not found: ${missing.join(", ")}`);
  return { book, page, file, split, sections: split.sections, failures };
}

async function saveBook({ book, page, file, split, sections, failures }) {
  const id = `dawa-${book.id}`;
  const dir = path.join(corpusDir, "books", id);
  const url = pageUrl(book);
  const title = page.title.replace(/^Dawah_center\s*-\s*/, "");
  const source = { publisher: "dawa.center", title, url, ...(page.file ? { file: page.file } : {}), fetchedOn: today };
  const saved = sections.map((section) => ({
    book: id,
    language: book.language,
    anchor: `q${section.number}`,
    heading: section.heading,
    pages: section.pages,
    paragraphs: section.parts.map((part, at) => ({ index: at + 1, part: part.part, text: part.text, ...(part.glyphs ? { glyphs: true } : {}) })),
    source,
  }));
  for (const section of saved) await writeJson(path.join(dir, `${section.anchor}.json`), section);
  await writeJson(path.join(dir, "index.json"), {
    id,
    language: book.language,
    title,
    ...(page.author ? { authors: [{ name: page.author, role: "author" }] } : {}),
    ...(page.publisher ? { publishedBy: page.publisher } : {}),
    ...(page.year ? { published: page.year } : {}),
    ...(page.rights ? { rights: page.rights } : {}),
    url,
    fetchedOn: today,
    format: "pdf",
    ...(file ? { file: path.relative(root, file).replaceAll(path.sep, "/") } : {}),
    split: "questions",
    chunking: "question",
    text: TEXT_RULE,
    ...(split ? { glyphPages: split.glyphPages.length, pages: split.pages } : {}),
    failures,
    sections: saved.map((section) => ({ file: `${section.anchor}.json`, anchor: section.anchor, heading: section.heading, paragraphs: section.paragraphs.length, characters: sectionCharacters(section) })),
  });
  return { id, language: book.language, sections: saved.length, failures };
}

export async function fetchDawaBooks({ refresh }) {
  const results = [];
  for (const book of DAWA_BOOKS) {
    const index = path.join(corpusDir, "books", `dawa-${book.id}`, "index.json");
    if (!refresh && (await exists(index))) {
      const saved = await readJson(index);
      results.push({ id: saved.id, language: saved.language, sections: saved.sections.length, failures: saved.failures });
      continue;
    }
    results.push(await saveBook(await fetchBook(book, refresh)));
  }
  return results;
}
