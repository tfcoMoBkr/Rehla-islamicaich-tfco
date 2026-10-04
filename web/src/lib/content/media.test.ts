import { describe, expect, it } from "vitest";

import { splitSentences } from "@/lib/audio/speech";

import { mediaSchema, referralCentresSchema } from "./schema";

const image = {
  type: "image",
  src: "wudu-tap.jpg",
  alt: { ar: "صنبور ماء", en: "A water tap" },
  credit: "Photographer",
  sourceUrl: "https://example.org/photo",
  licence: "CC BY 4.0",
};

describe("media slots", () => {
  it("accept an image with its credit, source and licence", () => {
    expect(mediaSchema.safeParse(image).success).toBe(true);
  });

  it.each(["credit", "sourceUrl", "licence"])("reject an image without its %s", (field) => {
    expect(mediaSchema.safeParse({ ...image, [field]: undefined }).success).toBe(false);
    expect(mediaSchema.safeParse({ ...image, [field]: "" }).success).toBe(false);
  });

  it("only take raster images from content/media", () => {
    expect(mediaSchema.safeParse({ ...image, src: "../secret.json" }).success).toBe(false);
    expect(mediaSchema.safeParse({ ...image, src: "../secret.png" }).success).toBe(false);
    expect(mediaSchema.safeParse({ ...image, src: "drawing.svg" }).success).toBe(false);
  });

  it("take an image from one folder down, no deeper", () => {
    expect(mediaSchema.safeParse({ ...image, src: "wudu-guide/p26-1.png" }).success).toBe(true);
    expect(mediaSchema.safeParse({ ...image, src: "a/b/c.png" }).success).toBe(false);
    expect(mediaSchema.safeParse({ ...image, src: "/wudu-guide/p26-1.png" }).success).toBe(false);
  });
});

describe("referral centres", () => {
  const national = {
    id: "national",
    type: "nationalChannel",
    name: { ar: "قناة وطنية", en: null },
    city: { ar: "وطني", en: null },
    neighbourhood: null,
    address: null,
    phone: "1933",
    phoneAlt: null,
    email: null,
    website: null,
    mapUrl: null,
    languages: null,
  };
  const file = (centers: unknown[]) => ({ source: "ncnp-directory", verifiedOn: "2026-10-04", centers });

  it("list the national channel first", () => {
    const association = { ...national, id: "a1", type: "association", city: { ar: "الرياض", en: "Riyadh" } };
    expect(referralCentresSchema.safeParse(file([national, association])).success).toBe(true);
    expect(referralCentresSchema.safeParse(file([association, national])).success).toBe(false);
  });

  it("need a way to reach them", () => {
    expect(referralCentresSchema.safeParse(file([{ ...national, phone: null }])).success).toBe(false);
    expect(referralCentresSchema.safeParse(file([{ ...national, phone: null, email: "info@example.org" }])).success).toBe(true);
  });
});

describe("splitSentences", () => {
  it("splits on Latin and Arabic sentence ends", () => {
    expect(splitSentences("One. Two? Three")).toEqual(["One.", "Two?", "Three"]);
    expect(splitSentences("الجملة الأولى. هل هذه الثانية؟ والثالثة")).toEqual([
      "الجملة الأولى.",
      "هل هذه الثانية؟",
      "والثالثة",
    ]);
  });
});
