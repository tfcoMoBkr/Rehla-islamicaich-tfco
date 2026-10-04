import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import type { z } from "zod";

import {
  fetchedAyahSchema,
  fetchedHadithSchema,
  fetchedRecitationSchema,
  lessonSchema,
  sourcesSchema,
  stationSchema,
  type FetchedAyah,
  type FetchedHadith,
  type FetchedRecitation,
  type Lesson,
  type Question,
  type Source,
  type Station,
} from "./schema";
import { showDrafts } from "./visibility";

const CONTENT_DIR = path.resolve(process.cwd(), "..", "content");

async function readValidated<T>(file: string, schema: z.ZodType<T>): Promise<T> {
  const raw: unknown = JSON.parse(await readFile(file, "utf8"));
  const result = schema.safeParse(raw);
  if (!result.success) {
    const where = path.relative(CONTENT_DIR, file);
    throw new Error(`Invalid content in ${where}:\n${result.error.message}`);
  }
  return result.data;
}

async function jsonFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return jsonFiles(full);
      return Promise.resolve(entry.name.endsWith(".json") ? [full] : []);
    }),
  );
  return nested.flat().sort();
}

/** "1.10" sorts after "1.9". */
export function compareLessonIds(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true });
}

export const loadSources = cache(async (): Promise<Source[]> => {
  const { sources } = await readValidated(path.join(CONTENT_DIR, "sources.json"), sourcesSchema);
  return sources;
});

export type StationEntry = Station & { lessonIds: string[] };

export type Khutuwat = {
  /** The main road, in order. */
  road: StationEntry[];
  /** Practice stations with neutral demo content. */
  practice: StationEntry[];
  lessons: ReadonlyMap<string, Lesson>;
};

function assertConsistent(stations: Station[], lessons: Lesson[]): void {
  const stationIds = new Set(stations.map((station) => station.id));
  const seen = new Set<string>();
  for (const lesson of lessons) {
    if (seen.has(lesson.id)) throw new Error(`Two lesson files have the id "${lesson.id}"`);
    seen.add(lesson.id);
    if (!stationIds.has(lesson.station)) {
      throw new Error(`Lesson "${lesson.id}" belongs to station "${lesson.station}", which has no file in content/stations/`);
    }
  }
}

function isVisible(lesson: Lesson, drafts: boolean): boolean {
  return drafts || lesson.reviewed || lesson.status === "demo";
}

function reviewedQuestions(questions: Question[], drafts: boolean): Question[] {
  return drafts ? questions : questions.filter((question) => question.reviewed);
}

export const loadKhutuwat = cache(async (): Promise<Khutuwat> => {
  const [stations, lessons] = await Promise.all([
    Promise.all((await jsonFiles(path.join(CONTENT_DIR, "stations"))).map((file) => readValidated(file, stationSchema))),
    Promise.all((await jsonFiles(path.join(CONTENT_DIR, "lessons"))).map((file) => readValidated(file, lessonSchema))),
  ]);
  assertConsistent(stations, lessons);

  const drafts = showDrafts();
  const visible = lessons
    .filter((lesson) => isVisible(lesson, drafts))
    .map((lesson) => ({ ...lesson, quiz: lesson.quiz && reviewedQuestions(lesson.quiz, drafts) }))
    .sort((a, b) => compareLessonIds(a.id, b.id));

  const entries = stations
    .map((station) => ({
      ...station,
      baseline: reviewedQuestions(station.baseline, drafts),
      exam: reviewedQuestions(station.exam, drafts),
      lessonIds: visible.filter((lesson) => lesson.station === station.id).map((lesson) => lesson.id),
    }))
    .filter((station) => station.lessonIds.length > 0)
    .sort((a, b) => a.order - b.order);

  return {
    road: entries.filter((station) => !station.demo),
    practice: entries.filter((station) => station.demo),
    lessons: new Map(visible.map((lesson) => [lesson.id, lesson])),
  };
});

async function readOptional<T>(file: string, schema: z.ZodType<T>): Promise<T | null> {
  try {
    return await readValidated(file, schema);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

/* Evidence saved by scripts/fetch-content.mjs. A missing file means it has not been fetched yet. */

export const readFetchedAyah = cache(
  (surah: number, ayah: number): Promise<FetchedAyah | null> =>
    readOptional(path.join(CONTENT_DIR, "fetched", "quran", `${surah}-${ayah}.json`), fetchedAyahSchema),
);

export const readFetchedHadith = cache(
  (id: number): Promise<FetchedHadith | null> =>
    readOptional(path.join(CONTENT_DIR, "fetched", "hadith", `${id}.json`), fetchedHadithSchema),
);

export const readFetchedRecitation = cache(
  (surah: number): Promise<FetchedRecitation | null> =>
    readOptional(path.join(CONTENT_DIR, "fetched", "recitation", `${surah}.json`), fetchedRecitationSchema),
);
