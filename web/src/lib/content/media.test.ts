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
  it("start as an empty list", () => {
    expect(referralCentresSchema.safeParse({ centers: [] }).success).toBe(true);
  });

  it("need a way to reach them", () => {
    const centre = {
      id: "c1",
      name: { ar: "مركز", en: "Centre" },
      kind: "centre",
      languages: ["ar"],
      sourceUrl: "https://example.org",
      verifiedOn: "2026-10-04",
    };
    expect(referralCentresSchema.safeParse({ centers: [centre] }).success).toBe(false);
    expect(referralCentresSchema.safeParse({ centers: [{ ...centre, url: "https://example.org" }] }).success).toBe(true);
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
