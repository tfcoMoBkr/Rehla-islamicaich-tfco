// What every corpus module shares: polite HTTP, resumable downloads, the Python helpers, and
// writing records. Every saved record names its source, public URL, language and fetch date.

import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const corpusDir = path.join(root, "content", "corpus");
export const sourcesDir = path.join(root, "content", "sources");
export const today = new Date().toISOString().slice(0, 10);

const USER_AGENT = "RehlaContentFetcher/1.0 (educational; texts kept verbatim with attribution)";
const MAX_TRIES = 6;
const run = promisify(execFile);
const lastRequest = new Map();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One request at a time per host, `gapMs` apart; a 429 or a dropped connection waits (honouring
 * Retry-After) and tries again. URLs that carry a key are never printed with it.
 */
export async function request(url, { gapMs = 1500, init = {} } = {}) {
  const host = new URL(url).host;
  const shown = url.replace(/(\/v3\/)[^/]+\//, "$1…/");
  for (let attempt = 1; ; attempt += 1) {
    await pause(Math.max(0, (lastRequest.get(host) ?? 0) + gapMs - Date.now()));
    lastRequest.set(host, Date.now());
    let response;
    try {
      response = await fetch(url, {
        ...init,
        headers: { "User-Agent": USER_AGENT, ...init.headers },
        signal: AbortSignal.timeout(120000),
      });
    } catch (error) {
      if (attempt === MAX_TRIES) throw new Error(`${shown}: ${error.message}`);
      await pause(gapMs * 2 ** attempt);
      continue;
    }
    if (response.status === 429 && attempt < MAX_TRIES) {
      await response.body?.cancel();
      const wait = Number(response.headers.get("retry-after")) * 1000 || gapMs * 2 ** attempt;
      console.log(`  ${host} asked to slow down; waiting ${Math.round(wait / 1000)}s`);
      await pause(wait);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      const error = new Error(`${shown} answered ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response;
  }
}

export const getJson = async (url, options) => (await request(url, options)).json();
export const getText = async (url, options) => (await request(url, options)).text();

export async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

/** Downloads once: a file already in content/sources/ is kept unless `refresh`. */
export async function download(url, file, { refresh = false, gapMs } = {}) {
  if (!refresh && (await exists(file))) return file;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await (await request(url, { gapMs })).arrayBuffer()));
  return file;
}

export async function writeJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

export const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));

/** Runs a Python helper through uv, with the packages it needs, and parses the JSON it prints. */
export async function python(script, packages, ...args) {
  const withs = packages.flatMap((name) => ["--with", name]);
  const { stdout } = await run("uv", ["run", "--no-project", ...withs, "python", script, ...args], {
    maxBuffer: 256 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

export const scriptPath = (...parts) => path.join(root, "scripts", ...parts);

/** Characters of text, the measure every report uses. */
export const characters = (texts) => texts.reduce((total, text) => total + [...text].length, 0);

/** Characters in a book section (paragraph texts only, headings excluded). */
export const sectionCharacters = (section) => characters(section.paragraphs.map((paragraph) => paragraph.text));
