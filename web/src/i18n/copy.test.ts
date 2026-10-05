import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import ar from "../../messages/ar.json";

const ROOT = path.resolve(__dirname, "../../..");
const SKIP = new Set(["node_modules", ".next", ".git", "corpus", "fetched", "results", "index", "__pycache__", ".venv"]);
// Built from parts so this file does not contain them itself.
const OLD_TAGLINES = [["رفيقك في", "طريق النور"].join(" "), ["companion on the", "path of light"].join(" ")];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return /\.(tsx?|mjs|json|md|py)$/.test(name) ? [full] : [];
  });
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("the product's own words", () => {
  it("write «رفيق» as a name, never with a case ending", () => {
    expect(strings(ar).filter((text) => /رفيق[ًٌٍ]/.test(text))).toEqual([]);
  });

  it("use the new tagline everywhere", () => {
    const stale = ["web", "docs", "content", "ai"].flatMap((dir) => files(path.join(ROOT, dir))).concat(path.join(ROOT, "README.md"));
    const found = stale.filter((file) => OLD_TAGLINES.some((tagline) => readFileSync(file, "utf8").includes(tagline)));
    expect(found.map((file) => path.relative(ROOT, file))).toEqual([]);
  });
});
