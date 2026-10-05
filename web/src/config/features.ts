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
  mawqif: false,
  adasa: false,
  community: false,
  aqim: false,
};

type Section = { feature: Feature; href: `/${string}` };

const sections: readonly Section[] = [
  { feature: "learn", href: "/learn" },
  { feature: "practice", href: "/practice" },
  { feature: "rafiq", href: "/rafiq" },
  { feature: "mawqif", href: "/mawqif" },
  { feature: "adasa", href: "/adasa" },
  { feature: "community", href: "/community" },
  { feature: "aqim", href: "/aqim" },
];

export const enabledSections: readonly Section[] = sections.filter(
  (section) => features[section.feature],
);
