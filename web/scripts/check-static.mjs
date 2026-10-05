// Fails the build when a main page, a drawing or an image is no longer rendered at build time.
// A page that becomes dynamic by accident (a request-time API, a fetch without caching) is rendered on every visit and
// cannot be prefetched, which is what makes moving between sections slow.
// Runs after `next build` and reads the prerender manifest Next writes.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import nextEnv from "@next/env";

const web = path.resolve(import.meta.dirname, "..");
const content = path.resolve(web, "..", "content");
const LOCALES = ["ar", "en"];
const PAGES = ["", "/learn", "/learn/journal", "/practice", "/rafiq", "/sources", "/talk-to-a-specialist", "/privacy"];
const ACCOUNT_PAGES = ["/account", "/account/sign-in", "/account/sign-up", "/account/reset", "/account/new-password"];

// The same variables `next build` saw: the account pages exist only when Supabase is configured (src/config/accounts.ts).
nextEnv.loadEnvConfig(web);
const accountsEnabled = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

async function lessonPaths() {
  const files = (await readdir(path.join(content, "lessons"), { recursive: true })).filter((file) => file.endsWith(".json"));
  const lessons = await Promise.all(files.map(async (file) => JSON.parse(await readFile(path.join(content, "lessons", file), "utf8"))));
  const stations = [...new Set(lessons.map((lesson) => String(lesson.station)))];
  // Practice: every activity of the road's lessons but reflections and private checklists (src/lib/learn/practice.ts).
  const practised = lessons
    .filter((lesson) => lesson.status === "published")
    .flatMap((lesson) =>
      lesson.activities
        .filter((activity) => activity.type !== "reflection" && (activity.type !== "checklist" || activity.mode === "quiz"))
        .map((activity) => `/practice/${lesson.id}/${activity.id}`),
    );
  return [
    ...lessons.map((lesson) => `/learn/${lesson.station}/${lesson.slug}`),
    ...stations.flatMap((station) => [`/learn/${station}/check`, `/learn/${station}/exam`]),
    ...practised,
  ];
}

/** The drawings, poses and images, served as static files so nothing in content/ is read at runtime. */
async function assetPaths() {
  const read = async (relative) => JSON.parse(await readFile(path.join(content, relative), "utf8"));
  const [art, rafiq, media] = await Promise.all([read("art/manifest.json"), read("art/rafiq/manifest.json"), read("media/manifest.json")]);
  return [
    ...art.items.map((item) => `/art/${item.file}`),
    ...rafiq.poses.map((pose) => `/art/${pose.file}`),
    ...media.images.map((image) => `/media/${image.src}`),
  ];
}

const manifest = JSON.parse(await readFile(path.join(web, ".next", "prerender-manifest.json"), "utf8"));
const prerendered = new Set(Object.keys(manifest.routes));
const pages = [...PAGES, ...(accountsEnabled ? ACCOUNT_PAGES : []), ...(await lessonPaths())];
const expected = LOCALES.flatMap((locale) => pages.map((page) => `/${locale}${page}`));
const assets = await assetPaths();
const missing = [...expected, ...assets].filter((route) => !prerendered.has(route));

if (missing.length > 0) {
  console.error(`These pages are no longer rendered at build time:\n${missing.map((route) => `  ${route}`).join("\n")}`);
  console.error("Find the request-time API (headers, cookies, connection, an uncached fetch) that made them dynamic.");
  process.exit(1);
}
console.log(`check-static: all ${expected.length} main pages and ${assets.length} drawings and images are rendered at build time.`);
