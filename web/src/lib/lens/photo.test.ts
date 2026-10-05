import { describe, expect, it } from "vitest";

import { checkFile, fitWithin, MAX_ORIGINAL_BYTES, MAX_UPLOAD_BYTES, preparePhoto, type ImageTools } from "./photo";

/** Image tools that record the size asked for and return a blob of the given size. */
function tools(width: number, height: number, encodedBytes = 120_000) {
  const encoded: { width: number; height: number }[] = [];
  const fake: ImageTools = {
    decode: async () => ({ width, height, source: {} as CanvasImageSource }),
    encode: async (_source, w, h) => {
      encoded.push({ width: w, height: h });
      return new Blob([new Uint8Array(encodedBytes)], { type: "image/jpeg" });
    },
    dataUrl: async () => "data:image/jpeg;base64,QUJD",
  };
  return { fake, encoded };
}

const photo = (type: string, size = 2_000_000) => new Blob([new Uint8Array(size)], { type });

describe("a photo prepared in the browser", () => {
  it("accepts JPEG, PNG and WebP only, and refuses an original too large to decode", () => {
    expect(checkFile({ type: "image/jpeg", size: 10 })).toBeNull();
    expect(checkFile({ type: "image/png", size: 10 })).toBeNull();
    expect(checkFile({ type: "image/webp", size: 10 })).toBeNull();
    expect(checkFile({ type: "application/pdf", size: 10 })).toBe("type");
    expect(checkFile({ type: "image/gif", size: 10 })).toBe("type");
    expect(checkFile({ type: "image/jpeg", size: MAX_ORIGINAL_BYTES + 1 })).toBe("size");
  });

  it("fits within 1280 px on its longer side, keeping its shape, and is never enlarged", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 960, height: 1280 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("is downscaled and re-encoded as JPEG, so its metadata stays behind", async () => {
    const { fake, encoded } = tools(4032, 3024);
    const prepared = await preparePhoto(photo("image/jpeg", 5_000_000), fake);

    expect(encoded).toEqual([{ width: 1280, height: 960 }]);
    expect(prepared).toEqual({ base64: "QUJD", mimeType: "image/jpeg", preview: "data:image/jpeg;base64,QUJD", width: 1280, height: 960 });
  });

  it("is never sent when the type is wrong or the prepared photo is over 4 MB", async () => {
    expect(await preparePhoto(photo("application/pdf"), tools(10, 10).fake)).toBe("type");
    expect(await preparePhoto(photo("image/png"), tools(1280, 1280, MAX_UPLOAD_BYTES + 1).fake)).toBe("size");
  });
});
