// hadeethenc.com: the category tree and the titles of the hadiths in chosen categories, in Arabic
// and English. Titles only: hadith texts are read live by Rafiq, never stored here. Every API page
// is cached under content/corpus/.cache/, so an interrupted run picks up where it stopped.

import path from "node:path";

import { corpusDir, exists, getJson, readJson, today, writeJson } from "./common.mjs";

const API = "https://hadeethenc.com/api/v1";
const LANGUAGES = ["ar", "en"];
const PER_PAGE = 20;

/** Purification (133) with its sub-categories, prayer, and creed: the categories the lessons draw on. */
const CHOSEN = [
  133,
  456, 457, 458, 460, 461, 462, 463, 464, 465, 466, 467, 469, 470, 472, 477, 478, 479, 480, 481,
  59, 72, 73, 74, 60, 61, 62, 81, 63, 64, 88, 91, 92, 94, 95, 271, 321, 338,
];
const WITH_DESCENDANTS = new Set([133]);

const cacheDir = path.join(corpusDir, ".cache", "hadeethenc");

async function cached(name, url, refresh) {
  const file = path.join(cacheDir, `${name}.json`);
  if (!refresh && (await exists(file))) return readJson(file);
  const data = await getJson(url);
  await writeJson(file, data);
  return data;
}

function descendants(tree, id) {
  const children = tree.filter((category) => category.parent === id).map((category) => category.id);
  return children.flatMap((child) => [child, ...descendants(tree, child)]);
}

export async function fetchHadithCatalogue({ refresh }) {
  const failures = [];
  const lists = {};
  for (const language of LANGUAGES) {
    lists[language] = await cached(`categories-${language}`, `${API}/categories/list/?language=${language}`, refresh);
  }

  const byId = new Map();
  for (const language of LANGUAGES) {
    for (const category of lists[language]) {
      const id = Number(category.id);
      const entry = byId.get(id) ?? { id, parent: category.parent_id ? Number(category.parent_id) : null, title: {}, hadeethsCount: {} };
      entry.title[language] = category.title;
      entry.hadeethsCount[language] = Number(category.hadeeths_count);
      byId.set(id, entry);
    }
  }
  const tree = [...byId.values()].sort((a, b) => a.id - b.id);

  const wanted = [...new Set(CHOSEN.flatMap((id) => (WITH_DESCENDANTS.has(id) ? [id, ...descendants(tree, id)] : [id])))];
  for (const id of wanted) if (!byId.has(id)) failures.push(`category ${id} is not in the category list`);

  const hadiths = new Map();
  for (const categoryId of wanted.filter((id) => byId.has(id))) {
    for (const language of LANGUAGES) {
      // A category the encyclopedia has only in Arabic has no list in English (the API answers 404).
      if (!byId.get(categoryId).title[language]) continue;
      for (let page = 1, last = 1; page <= last; page += 1) {
        const url = `${API}/hadeeths/list/?language=${language}&category_id=${categoryId}&page=${page}&per_page=${PER_PAGE}`;
        let data;
        try {
          data = await cached(`list-${language}-${categoryId}-${page}`, url, refresh);
        } catch (error) {
          failures.push(`category ${categoryId} (${language}) page ${page}: ${error.message}`);
          break;
        }
        last = Number(data.meta?.last_page ?? 1);
        for (const listed of data.data ?? []) {
          const id = Number(listed.id);
          const entry = hadiths.get(id) ?? { id, title: {}, categories: [], translations: [] };
          entry.title[language] = listed.title;
          if (!entry.categories.includes(categoryId)) entry.categories.push(categoryId);
          if (Array.isArray(listed.translations) && listed.translations.length > entry.translations.length) {
            entry.translations = listed.translations;
          }
          hadiths.set(id, entry);
        }
      }
    }
  }

  const records = [...hadiths.values()]
    .sort((a, b) => a.id - b.id)
    .map(({ id, title, categories, translations }) => ({
      id,
      title,
      categories: categories.sort((a, b) => a - b),
      url: Object.fromEntries(LANGUAGES.filter((language) => title[language]).map((language) => [language, `https://hadeethenc.com/${language}/browse/hadith/${id}`])),
      // Listed only in Arabic: the encyclopedia has no English title for it in these categories.
      ...(title.en ? {} : { noEnglishTitle: true, englishTranslationListed: translations.includes("en") }),
    }));

  await writeJson(path.join(corpusDir, "hadith-catalogue.json"), {
    source: { publisher: "HadeethEnc.com", url: "https://hadeethenc.com", api: API, fetchedOn: today },
    text: "Category and hadith titles exactly as the HadeethEnc API returns them. Titles only: hadith texts, grades and explanations are read live (MCP get_hadith) and never stored here.",
    chosenCategories: wanted,
    categories: tree.map((category) => ({ ...category, chosen: wanted.includes(category.id) })),
    hadiths: records,
  });
  return { hadiths: records, categories: tree.length, chosen: wanted.length, failures };
}
