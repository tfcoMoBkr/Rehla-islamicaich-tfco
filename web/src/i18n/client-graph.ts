import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/*
 * Which message namespaces a page's client components read. A module is a client module when it
 * says "use client" or is imported by one; the namespaces are those its useTranslations calls name.
 * Used by the test that keeps each page's client messages complete (client-messages.test.ts).
 */

const SRC = path.resolve(__dirname, "..");
const EXTENSIONS = [".tsx", ".ts", "/index.tsx", "/index.ts"];
const IMPORT = /^\s*import\s+(?!type\b)[^;]*?from\s+"([^"]+)";/gm;
const SIDE_EFFECT_IMPORT = /^\s*import\s+"([^"]+)";/gm;
const NAMESPACE = /useTranslations\(\s*"([\w.]+)"\s*\)/g;
// next/dynamic and lazy imports load client code too.
const DYNAMIC_IMPORT = /\bimport\(\s*"([^"]+)"\s*\)/g;

function resolve(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? path.join(SRC, specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(from), specifier)
      : null;
  if (!base) return null;
  if (existsSync(base) && /\.tsx?$/.test(base)) return base;
  for (const extension of EXTENSIONS) {
    if (existsSync(base + extension)) return base + extension;
  }
  return null;
}

function read(file: string): { client: boolean; imports: string[]; namespaces: string[] } {
  const source = readFileSync(file, "utf8");
  const specifiers = [...source.matchAll(IMPORT), ...source.matchAll(SIDE_EFFECT_IMPORT), ...source.matchAll(DYNAMIC_IMPORT)].map(
    (match) => match[1],
  );
  return {
    client: /^\s*["']use client["']/.test(source),
    imports: specifiers.flatMap((specifier) => resolve(file, specifier) ?? []),
    namespaces: [...source.matchAll(NAMESPACE)].map((match) => match[1].split(".")[0]),
  };
}

/** The top-level namespaces read by client modules reachable from `entry` (a file under src/). */
export function clientNamespaces(entry: string): Set<string> {
  const found = new Set<string>();
  const seen = new Set<string>();
  const visit = (file: string, insideClient: boolean) => {
    const key = `${file}:${insideClient}`;
    if (seen.has(key)) return;
    seen.add(key);
    const parsed = read(file);
    const client = insideClient || parsed.client;
    if (client) parsed.namespaces.forEach((namespace) => found.add(namespace));
    parsed.imports.forEach((next) => visit(next, client));
  };
  visit(path.join(SRC, entry), false);
  return found;
}

/** Every source module reachable from `entry` (server and client, static and lazy imports), relative to src/. */
export function modulesFrom(entry: string): Set<string> {
  const found = new Set<string>();
  const visit = (file: string) => {
    const relative = path.relative(SRC, file).replaceAll("\\", "/");
    if (found.has(relative)) return;
    found.add(relative);
    read(file).imports.forEach(visit);
  };
  visit(path.join(SRC, entry));
  return found;
}
