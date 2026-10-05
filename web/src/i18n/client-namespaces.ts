import type en from "../../messages/en.json";

/*
 * The message namespaces each page sends to the browser. Server components read every message on
 * the server; only what client components read is sent, so a page does not carry the whole
 * dictionary. client-messages.test.ts checks these lists against the client components each page
 * actually imports.
 */

export type Namespace = keyof typeof en;

/** Read by client components in the locale layout (header, footer, loading states). */
export const LAYOUT_NAMESPACES = [
  "AccountChoice",
  "AccountEntry",
  "AiServiceStatus",
  "Common",
  "Error",
  "Guide",
  "LocaleSwitcher",
  "Navigation",
  "RafiqCharacter",
] as const satisfies readonly Namespace[];

export const PAGE_NAMESPACES = {
  home: ["MeetRafiq"],
  /** The road, and the tour's working previews. */
  learn: ["Activity", "Learn", "Learning", "Question"],
  journal: ["AccountStatus", "Journal", "Practice"],
  lesson: [
    "AccountInvite",
    "Activity",
    "Assessment",
    "Board",
    "Learn",
    "Learning",
    "Lesson",
    "LineHelp",
    "Listen",
    "Question",
    "Rafiq",
    "RafiqCaptions",
    "Specialist",
  ],
  check: ["Activity", "Assessment", "Baseline", "Learn", "Learning", "Question"],
  exam: ["Activity", "Assessment", "Exam", "Learn", "Learning", "Question"],
  rafiq: ["Lesson", "MeetRafiq", "Rafiq", "Specialist"],
  practice: ["Practice"],
  practiceRound: ["Activity", "Board", "Learning", "Lesson", "LineHelp", "Listen", "Practice", "Question"],
  sources: [],
  specialists: [],
  account: ["Account", "AccountStatus"],
  signIn: ["Account"],
  signUp: ["Account"],
  privacy: [],
  lens: ["Lens", "Lesson", "Rafiq", "Specialist"],
  mawqif: ["Mawqif", "Practice"],
  situation: ["Lesson", "Listen", "Mawqif", "Rafiq", "Specialist"],
  mawqifTest: ["Lesson", "Listen", "Mawqif"],
} as const satisfies Record<string, readonly Namespace[]>;

export type ClientPage = keyof typeof PAGE_NAMESPACES;
