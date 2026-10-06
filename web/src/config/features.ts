export type Feature =
  | "learn"
  | "practice"
  | "rafiq"
  | "mawqif"
  | "adasa"
  | "community"
  | "aqim";

export const features: Readonly<Record<Feature, boolean>> = {
  learn: true,
  practice: true,
  rafiq: true,
  mawqif: true,
  adasa: true,
  community: true,
  aqim: false,
};

/** Parts of a section that ship behind their own switch. */
export const parts = {
  /** Mawqif's phrases to say: the Arabic, an approximate pronunciation, the meaning, and "listen". */
  phraseAids: true,
} as const;

export type Section = { feature: Feature; href: `/${string}` };

/** Every section of the product in its planned order, built or not. */
export const sections: readonly Section[] = [
  { feature: "learn", href: "/learn" },
  { feature: "practice", href: "/practice" },
  { feature: "rafiq", href: "/rafiq" },
  { feature: "mawqif", href: "/mawqif" },
  { feature: "adasa", href: "/lens" },
  { feature: "community", href: "/community" },
  { feature: "aqim", href: "/aqim" },
];

export const enabledSections: readonly Section[] = sections.filter(
  (section) => features[section.feature],
);
