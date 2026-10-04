import { describe, expect, it } from "vitest";

import { stableShuffle } from "./shuffle";

const items = ["a", "b", "c", "d"].map((id) => ({ id }));

describe("stableShuffle", () => {
  it("gives the same order for the same seed (server and browser agree)", () => {
    expect(stableShuffle(items, "seed")).toEqual(stableShuffle(items, "seed"));
  });

  it("never returns the already-solved order", () => {
    for (const seed of ["x", "y", "z", "lesson-1:0", "lesson-2:3"]) {
      expect(stableShuffle(items, seed).map((item) => item.id)).not.toEqual(["a", "b", "c", "d"]);
    }
  });

  it("keeps every item", () => {
    expect(stableShuffle(items, "seed").map((item) => item.id).sort()).toEqual(["a", "b", "c", "d"]);
  });
});
