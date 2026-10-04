// Every book Rafiq can draw on, wherever it was saved: the corpus books (content/corpus/books/) and
// the lesson books already fetched for Khutuwat (content/fetched/books/, left where they are).

import { readdir } from "node:fs/promises";
import path from "node:path";

import { corpusDir, exists, readJson, root, sectionCharacters } from "./common.mjs";

export const FETCHED_BOOKS = ["1871", "62675", "2842316", "1261"];

async function corpusBook(id) {
  const dir = path.join(corpusDir, "books", id);
  const index = await readJson(path.join(dir, "index.json"));
  const sections = [];
  for (const entry of index.sections) {
    const section = await readJson(path.join(dir, entry.file));
    sections.push({ anchor: entry.anchor, heading: entry.heading, file: path.join(dir, entry.file), characters: sectionCharacters(section) });
  }
  return { id, language: index.language, title: index.title, url: index.url, dir, kind: "corpus", failures: index.failures ?? [], sections };
}

async function fetchedBook(id) {
  const dir = path.join(root, "content", "fetched", "books", id);
  const index = await readJson(path.join(dir, "index.json"));
  const sections = [];
  for (const part of index.parts) {
    for (const entry of part.sections) {
      const file = path.join(dir, `${entry.anchor}.json`);
      sections.push({ anchor: entry.anchor, heading: entry.heading, file, characters: sectionCharacters(await readJson(file)) });
    }
  }
  return { id, language: index.language, title: index.title, url: index.url, dir, kind: "fetched", failures: [], sections };
}

export async function loadBooks() {
  const books = [];
  const corpusBooks = path.join(corpusDir, "books");
  if (await exists(corpusBooks)) {
    for (const entry of await readdir(corpusBooks, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== "pairs" && (await exists(path.join(corpusBooks, entry.name, "index.json")))) {
        books.push(await corpusBook(entry.name));
      }
    }
  }
  for (const id of FETCHED_BOOKS) {
    if (await exists(path.join(root, "content", "fetched", "books", id, "index.json"))) books.push(await fetchedBook(id));
  }
  return books;
}

export const relative = (file) => path.relative(root, file).replaceAll(path.sep, "/");
