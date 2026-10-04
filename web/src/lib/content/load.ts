import "server-only";

import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import type { z } from "zod";

import { cleanSvg } from "./scene-svg";
import {
  artManifestSchema,
  fetchedAyahSchema,
  fetchedHadithSchema,
  fetchedRecitationSchema,
  lessonSchema,
  mediaManifestSchema,
  rafiqManifestSchema,
  referralCentresSchema,
  sourcesSchema,
  stationSchema,
  visualsSchema,
  type ArtManifest,
  type FetchedAyah,
  type FetchedHadith,
  type FetchedRecitation,
  type Lesson,
  type LessonVisual,
  type Media,
  type MediaManifest,
  type Question,
  type RafiqManifest,
  type ReferralCentre,
  type Source,
  type Station,
} from "./schema";
import { showDrafts } from "./visibility";

const CONTENT_DIR = path.resolve(process.cwd(), "..", "content");
const MEDIA_DIR = path.join(CONTENT_DIR, "media");
const ART_DIR = path.join(CONTENT_DIR, "art");

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

export const loadMediaManifest = cache(
  (): Promise<MediaManifest> => readValidated(path.join(MEDIA_DIR, "manifest.json"), mediaManifestSchema),
);

/** Every media item of a lesson: on the lesson, its cards and its steps. */
export function lessonMedia(lesson: Lesson): Media[] {
  return [
    ...(lesson.media ?? []),
    ...lesson.cards.flatMap((card) => card.media ?? []),
    ...(lesson.steps ?? []).flatMap((step) => step.media ?? []),
  ];
}

/** An image must be listed in content/media/manifest.json and present beside it. */
async function assertMediaPresent(lessons: Lesson[], manifest: MediaManifest): Promise<void> {
  for (const lesson of lessons) {
    for (const media of lessonMedia(lesson)) {
      if (media.type !== "image") continue;
      if (!manifest.images.some((image) => image.src === media.src)) {
        throw new Error(`Lesson "${lesson.id}" uses image "${media.src}", which is not in content/media/manifest.json`);
      }
      try {
        await access(path.join(MEDIA_DIR, media.src));
      } catch {
        throw new Error(`Lesson "${lesson.id}" uses image "${media.src}", which is not in content/media/`);
      }
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
  await assertMediaPresent(lessons, await loadMediaManifest());

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

export const loadReferralCentres = cache(async (): Promise<ReferralCentre[]> => {
  const { centers } = await readValidated(path.join(CONTENT_DIR, "referral-centers.json"), referralCentresSchema);
  return centers;
});

const IMAGE_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

export const loadArtManifest = cache(
  (): Promise<ArtManifest> => readValidated(path.join(ART_DIR, "manifest.json"), artManifestSchema),
);

export const loadVisuals = cache(async (): Promise<LessonVisual[]> => {
  const { lessons } = await readValidated(path.join(CONTENT_DIR, "visuals.json"), visualsSchema);
  return lessons;
});

export const loadRafiqManifest = cache(
  (): Promise<RafiqManifest> => readValidated(path.join(ART_DIR, "rafiq", "manifest.json"), rafiqManifestSchema),
);

/** One of Rafiq's poses (content/art/rafiq/), only if his manifest lists it. */
export async function readRafiqPose(file: string): Promise<Buffer | null> {
  const manifest = await loadRafiqManifest();
  if (!manifest.poses.some((pose) => pose.file === file)) return null;
  try {
    return await readFile(path.join(ART_DIR, file));
  } catch {
    return null;
  }
}

/** A drawing from content/art/, cleaned for inline use, only if the art manifest lists it. */
export const readArtSvg = cache(async (file: string): Promise<string | null> => {
  const manifest = await loadArtManifest();
  if (!manifest.items.some((item) => item.file === file)) return null;
  try {
    return cleanSvg(await readFile(path.join(ART_DIR, file), "utf8"), file);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
});

/** An image from content/media/, only if the manifest lists it (its schema keeps every listed path inside the folder). */
export async function readMediaFile(name: string): Promise<{ body: Buffer; type: string } | null> {
  const type = IMAGE_TYPES[path.extname(name).toLowerCase()];
  const manifest = await loadMediaManifest();
  if (!type || !manifest.images.some((image) => image.src === name)) return null;
  try {
    return { body: await readFile(path.join(MEDIA_DIR, name)), type };
  } catch {
    return null;
  }
}
