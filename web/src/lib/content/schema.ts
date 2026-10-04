import { z } from "zod";

/*
 * The shape of content/. Lesson files are written by the team (content/lessons/drafts/) and
 * define this schema; the engine renders them as they are. Station files and the practice
 * lesson are the engine's own.
 */

export const bilingual = z.object({ ar: z.string(), en: z.string() });
const choice = bilingual.extend({ correct: z.boolean() });
const numbered = bilingual.extend({ n: z.number().int() });
const groupDef = z.object({ key: z.string(), label: bilingual });

export const evidenceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("quran"),
    ref: z.string().regex(/^\d+:\d+(-\d+)?$/),
    publisher: z.string(),
  }),
  z.object({
    type: z.literal("hadith"),
    hadeethencId: z.number().int().nullable(),
    citation: z.string(),
    availableIn: z.array(z.enum(["ar", "en"])),
    publisher: z.string(),
  }),
]);

/** A raster image in content/media/, at its top level or in one folder (e.g. a guide's pictures). */
const mediaSrc = z
  .string()
  .regex(/^(?:[\w-]+\/)?[\w-]+\.(?:jpe?g|png|webp|avif)$/i, "Images are .jpg, .png, .webp or .avif files in content/media/");

/** Pictures and clips added to a lesson, card or step. Unlicensed or uncredited media is rejected. */
const mediaCredit = {
  alt: bilingual,
  credit: z.string().trim().min(1),
  sourceUrl: z.url(),
  licence: z.string().trim().min(1),
};
export const mediaSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("image"),
    /** A file in content/media/, listed in content/media/manifest.json. */
    src: mediaSrc,
    ...mediaCredit,
  }),
  z.object({ type: z.literal("video"), youtubeId: z.string().regex(/^[\w-]{11}$/), ...mediaCredit }),
]);
const mediaList = z.array(mediaSchema).optional();


const trueFalse = z.object({ type: z.literal("trueFalse"), prompt: bilingual, answer: z.boolean() });
const single = z.object({ type: z.literal("single"), prompt: bilingual, options: z.array(choice).min(2) });
const multiple = z.object({ type: z.literal("multiple"), prompt: bilingual, options: z.array(choice).min(2) });
const orderQuestion = z.object({ type: z.literal("order"), prompt: bilingual, items: z.array(numbered).min(2) });
const matchQuestion = z.object({
  type: z.literal("match"),
  prompt: bilingual,
  pairs: z.array(z.object({ left: bilingual, right: bilingual })).min(2),
});
const sortQuestion = z.object({
  type: z.literal("sort"),
  prompt: bilingual,
  groups: z.array(groupDef).min(2),
  items: z.array(bilingual.extend({ group: z.string() })).min(2),
});

/** The unscored check after a card, as lesson files write it. */
export const checkSchema = z.discriminatedUnion("type", [trueFalse, single]);

/** A scored question (quiz, "what do I know?", station exam). */
export const questionSchema = z.discriminatedUnion("type", [
  trueFalse,
  single,
  multiple,
  orderQuestion,
  matchQuestion,
  sortQuestion,
]).and(
  z.object({
    id: z.string(),
    objective: z.string(),
    reviewed: z.boolean(),
    /** The card the question is answered by; its text is quoted in feedback and review. */
    card: z.string().optional(),
    lesson: z.string().optional(),
  }),
);

const activityBase = { id: z.string(), title: bilingual, instruction: bilingual.optional() };
/** Activities may take their items from a list in the lesson file (e.g. "steps"). */
const dataRef = z.string();

export const activitySchema = z.discriminatedUnion("type", [
  z.object({
    ...activityBase,
    type: z.literal("order"),
    visual: z.string().optional(),
    items: z.union([z.array(numbered), dataRef]),
    correctOrder: z.array(z.number().int()).optional(),
  }),
  z.object({
    ...activityBase,
    type: z.literal("timeline"),
    items: z.array(numbered.extend({ year: z.string().optional() })),
  }),
  z.object({
    ...activityBase,
    type: z.literal("sort"),
    groups: z.array(groupDef.extend({ steps: z.array(z.number().int()).optional() })).min(2),
    items: z.array(bilingual.extend({ group: z.string(), card: z.string().optional() })).optional(),
  }),
  z.object({
    ...activityBase,
    type: z.literal("swipe"),
    sides: z.object({ left: bilingual, right: bilingual }),
    items: z.array(bilingual.extend({ side: z.enum(["left", "right"]) })),
  }),
  z.object({
    ...activityBase,
    type: z.literal("select"),
    visual: z.string().optional(),
    mode: z.literal("cases").optional(),
    items: z.array(choice).optional(),
    feedbackWrong: bilingual.optional(),
    cases: z
      .array(z.object({ prompt: bilingual, options: z.array(z.string()).min(2), answer: z.string() }))
      .optional(),
  }),
  z.object({
    ...activityBase,
    type: z.literal("match"),
    pairs: z.array(z.object({ left: bilingual, right: bilingual, card: z.string().optional() })).optional(),
    allowRepeatedRight: z.boolean().optional(),
    items: dataRef.optional(),
    leftFrom: z.string().optional(),
    rightFrom: z.string().optional(),
    exclude: z.array(z.string()).optional(),
  }),
  z.object({
    ...activityBase,
    type: z.literal("checklist"),
    mode: z.literal("quiz").optional(),
    storage: z.literal("deviceOnly").optional(),
    items: z.array(bilingual.extend({ correct: z.boolean().optional(), card: z.string().optional() })),
  }),
  z.object({ ...activityBase, type: z.literal("reflection"), items: dataRef, storage: z.literal("deviceOnly") }),
  z.object({
    ...activityBase,
    type: z.literal("guided"),
    items: z.union([dataRef, z.array(dataRef)]),
    note: bilingual.optional(),
  }),
  z.object({
    ...activityBase,
    type: z.literal("decisionPath"),
    source: z.string().optional(),
    steps: z.array(z.object({ q: bilingual, yes: bilingual.optional(), no: bilingual.optional() })).min(1),
    end: bilingual,
  }),
  z.object({ ...activityBase, type: z.literal("dayArc"), items: dataRef, markers: z.array(z.string()).optional() }),
  z.object({
    ...activityBase,
    type: z.literal("ayahByAyah"),
    items: dataRef,
    text: z.literal("quranenc.com"),
    audio: z.literal("mp3quran.net").optional(),
  }),
]);

const video = z
  .object({
    youtubeId: z.string().optional(),
    playlistId: z.string().optional(),
    channel: z.string(),
    sourcePage: z.url().optional(),
    position: z.enum(["close", "beforeActivity"]),
  })
  .refine((value) => Boolean(value.youtubeId) !== Boolean(value.playlistId), {
    message: "A video has exactly one of youtubeId or playlistId",
  });

const sourceRefs = z.array(z.string());

export const lessonSchema = z.object({
  id: z.string().regex(/^[\w.-]+$/),
  station: z.union([z.number().int(), z.string()]).transform(String),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  status: z.enum(["draft", "demo"]),
  reviewed: z.boolean(),
  reviewedBy: z.string().nullable(),
  title: bilingual,
  objectives: z.object({ ar: z.array(z.string()), en: z.array(z.string()) }),
  sources: z.array(
    z.object({ key: z.string(), title: bilingual, publisher: z.string(), url: bilingual, use: z.string() }),
  ),
  suggestedVideo: z.object({ ar: video.nullable(), en: video.nullable() }),
  cards: z.array(
    z.object({
      id: z.string(),
      source: sourceRefs,
      text: bilingual,
      evidence: evidenceSchema.optional(),
      check: checkSchema.optional(),
      display: z.literal("evidenceFirst").optional(),
      media: mediaList,
    }),
  ),
  activities: z.array(activitySchema),
  situation: z
    .object({
      source: sourceRefs.optional(),
      prompt: bilingual,
      options: z.array(choice).min(2),
      followUp: bilingual.optional(),
    })
    .nullable(),
  explainToRafiq: z.object({ prompt: bilingual, scope: z.array(z.string()) }).optional(),
  readMore: z.array(bilingual).default([]),
  laterTopics: z.array(z.object({ topic: bilingual, lesson: z.string() })).optional(),
  reviewNotes: z.array(z.string()).optional(),
  steps: z
    .array(
      z.object({
        n: z.number().int(),
        key: z.string().optional(),
        source: sourceRefs.optional(),
        title: bilingual,
        text: bilingual,
        repeat: z.string().optional(),
        say: z.string().optional(),
        evidence: evidenceSchema.optional(),
        media: mediaList,
      }),
    )
    .optional(),
  afterRakah: z
    .array(z.object({ key: z.string(), source: sourceRefs.optional(), text: bilingual, evidence: evidenceSchema.optional() }))
    .optional(),
  prayers: z
    .array(z.object({ key: z.string(), name: bilingual, rakahs: z.number().int(), time: bilingual }))
    .optional(),
  ayat: z
    .array(z.object({ ref: z.string().regex(/^\d+:\d+$/), source: sourceRefs.optional(), meaning: bilingual.nullable() }))
    .optional(),
  /** Scored questions closing the lesson (lessons marked 🔹 in docs/CURRICULUM.md). */
  quiz: z.array(questionSchema).optional(),
  media: mediaList,
});

export const stationSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  demo: z.boolean(),
  title: bilingual,
  baseline: z.array(questionSchema),
  exam: z.array(questionSchema),
});

export const mediaManifestSchema = z.object({
  images: z.array(
    z.object({
      src: mediaSrc,
      credit: z.string().trim().min(1),
      sourceUrl: z.url(),
      licence: z.string().trim().min(1),
    }),
  ),
});

/** The team's own illustrations in content/art/, listed in content/art/manifest.json. */
export const artManifestSchema = z.object({
  credit: z.string().trim().min(1),
  licence: z.string().trim().min(1),
  items: z.array(
    z.object({
      file: z.string().regex(/^(scenes|icons)\/[\w-]+\.svg$/, "Art files are .svg files in content/art/scenes or content/art/icons"),
      description: z.string().trim().min(1),
      credit: z.string().trim().min(1),
      licence: z.string().trim().min(1),
    }),
  ),
});

export const RAFIQ_POSES = [
  "hello",
  "waving",
  "walking",
  "writing",
  "thinking",
  "happy",
  "encouraging",
  "pointing",
  "listening",
] as const;

/** Rafiq's character: one transparent PNG per pose in content/art/rafiq/, with its pixel size. */
export const rafiqManifestSchema = z
  .object({
    character: z.string().trim().min(1),
    credit: z.string().trim().min(1),
    licence: z.string().trim().min(1),
    poses: z.array(
      z.object({
        file: z.string().regex(/^rafiq\/[\w-]+\.png$/, "Poses are .png files in content/art/rafiq"),
        pose: z.enum(RAFIQ_POSES),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      }),
    ),
  })
  .refine((manifest) => RAFIQ_POSES.every((pose) => manifest.poses.filter((entry) => entry.pose === pose).length === 1), {
    message: "Every pose of Rafiq appears exactly once",
  });

const partId = z.string().regex(/^[\w-]+$/);

/**
 * The drawing pinned on each lesson's board (content/visuals.json): which scenes it shows, the
 * parts that light up as the learner moves through the lesson, the parts that fade away, and a
 * part that travels to the place of the step in focus (the sun along the day's arc).
 */
export const visualsSchema = z.object({
  lessons: z.array(
    z.object({
      lesson: z.string(),
      scenes: z.array(partId).min(1),
      reveal: z.array(partId).default([]),
      clear: z.array(partId).default([]),
      follow: z.object({ part: partId, along: z.array(partId).min(1) }).optional(),
      ambience: z.enum(["water"]).optional(),
      /** Mirror the drawing in right-to-left pages, where time and reading run the other way. */
      mirrorRtl: z.boolean().default(false),
      /** Shown only where drafts are shown, labelled as awaiting review. */
      needsReview: z.boolean().default(false),
    }),
  ),
});

const contactRequired = (centre: { phone?: string; email?: string; url?: string }) =>
  Boolean(centre.phone || centre.email || centre.url);

export const referralCentresSchema = z.object({
  centers: z.array(
    z
      .object({
        id: z.string(),
        name: bilingual,
        kind: z.enum(["centre", "phone", "online"]),
        /** ISO codes of the languages the centre can help in. */
        languages: z.array(z.string()).min(1),
        city: bilingual.optional(),
        address: bilingual.optional(),
        phone: z.string().optional(),
        email: z.email().optional(),
        url: z.url().optional(),
        hours: bilingual.optional(),
        notes: bilingual.optional(),
        /** Where the contact details were checked. */
        sourceUrl: z.url(),
        verifiedOn: z.iso.date(),
      })
      .refine(contactRequired, { message: "A referral centre needs a phone number, an email or a website" }),
  ),
});

export const sourcesSchema = z.object({
  sources: z.array(
    z
      .object({
        id: z.string(),
        /** `reference`: linked only, nothing stored or quoted. `retrieval`: read live, nothing stored. */
        type: z.enum(["quran", "hadith", "lessons", "video", "terminology", "referral", "illustrations", "retrieval", "reference"]),
        name: bilingual,
        /** Other names lesson files may use for this source, e.g. a channel name. */
        aliases: z.array(z.string()).default([]),
        /** Only the team's own illustrations, kept in this repository, have no address elsewhere. */
        url: z.url().optional(),
        alsoAt: z.array(z.url()),
        usedFor: bilingual,
        licence: bilingual,
        status: z.enum(["approved", "pendingReview"]),
        verifiedOn: z.iso.date(),
      })
      .refine((source) => source.url !== undefined || source.type === "illustrations", {
        message: "A source needs a url",
      }),
  ),
});

/* Files written by scripts/fetch-content.mjs. */

export const fetchedAyahSchema = z.object({
  ref: z.string(),
  arabic: z.string(),
  translations: z.object({
    en: z.object({ key: z.string(), version: z.string().nullable(), text: z.string(), footnotes: z.string().nullable() }),
  }),
  source: z.object({ publisher: z.string(), url: z.url(), fetchedOn: z.string() }),
});

const fetchedHadithVersion = z.object({
  title: z.string(),
  hadeeth: z.string(),
  attribution: z.string(),
  grade: z.string(),
  explanation: z.string(),
  hints: z.array(z.string()),
  url: z.url(),
  version: z.string().nullable(),
  fetchedOn: z.string(),
});

export const fetchedHadithSchema = z.object({
  id: z.number(),
  publisher: z.string(),
  languages: z.object({ ar: fetchedHadithVersion.optional(), en: fetchedHadithVersion.optional() }),
});

export const fetchedRecitationSchema = z.object({
  surah: z.number(),
  read: z.number(),
  reciter: z.string(),
  audioUrl: z.url(),
  ayahs: z.array(z.object({ ayah: z.number(), start: z.number(), end: z.number() })),
});

export type Bilingual = z.infer<typeof bilingual>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Check = z.infer<typeof checkSchema>;
export type Question = z.infer<typeof questionSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Station = z.infer<typeof stationSchema>;
export type Source = z.infer<typeof sourcesSchema>["sources"][number];
export type SourceType = Source["type"];
export type FetchedAyah = z.infer<typeof fetchedAyahSchema>;
export type FetchedHadith = z.infer<typeof fetchedHadithSchema>;
export type FetchedRecitation = z.infer<typeof fetchedRecitationSchema>;
export type Media = z.infer<typeof mediaSchema>;
export type MediaManifest = z.infer<typeof mediaManifestSchema>;
export type ArtManifest = z.infer<typeof artManifestSchema>;
export type RafiqManifest = z.infer<typeof rafiqManifestSchema>;
export type RafiqPose = (typeof RAFIQ_POSES)[number];
export type LessonVisual = z.infer<typeof visualsSchema>["lessons"][number];
export type ReferralCentre = z.infer<typeof referralCentresSchema>["centers"][number];
