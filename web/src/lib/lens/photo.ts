/*
 * A photo prepared in the browser before it is sent: checked, downscaled to at most 1280 px on its
 * longer side, and re-encoded as JPEG. Drawing it on a canvas and encoding it again leaves its
 * metadata (location, camera, time) behind.
 *
 * The 4 MB limit applies to what is sent, as the service enforces it. A phone's own photo is often
 * larger than that before it is downscaled, so the original may be up to MAX_ORIGINAL_BYTES.
 */

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;
export const MAX_SIDE = 1280;
const QUALITY = 0.85;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);

export type FileProblem = "type" | "size";

export function checkFile(file: Pick<Blob, "type" | "size">): FileProblem | null {
  if (!ACCEPTED.has(file.type)) return "type";
  if (file.size > MAX_ORIGINAL_BYTES) return "size";
  return null;
}

/** The largest size within `max` on both sides that keeps the photo's shape; never enlarged. */
export function fitWithin(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export type PreparedPhoto = { base64: string; mimeType: "image/jpeg"; preview: string; width: number; height: number };

/** How the browser decodes and re-encodes an image; tests pass their own. */
export type ImageTools = {
  decode: (file: Blob) => Promise<{ width: number; height: number; source: CanvasImageSource }>;
  encode: (source: CanvasImageSource, width: number, height: number) => Promise<Blob>;
  dataUrl: (blob: Blob) => Promise<string>;
};

export const browserTools: ImageTools = {
  async decode(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { width: bitmap.width, height: bitmap.height, source: bitmap };
  },
  async encode(source, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no canvas");
    context.drawImage(source, 0, 0, width, height);
    return new Promise((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("not encoded"))), "image/jpeg", QUALITY),
    );
  },
  dataUrl: (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    }),
};

/** The photo ready to send, or the reason it cannot be: never sent when over the upload limit. */
export async function preparePhoto(file: Blob, tools: ImageTools = browserTools): Promise<PreparedPhoto | FileProblem> {
  const problem = checkFile(file);
  if (problem) return problem;
  const decoded = await tools.decode(file);
  const size = fitWithin(decoded.width, decoded.height);
  const jpeg = await tools.encode(decoded.source, size.width, size.height);
  if (jpeg.size > MAX_UPLOAD_BYTES) return "size";
  const preview = await tools.dataUrl(jpeg);
  return { base64: preview.slice(preview.indexOf(",") + 1), mimeType: "image/jpeg", preview, ...size };
}
