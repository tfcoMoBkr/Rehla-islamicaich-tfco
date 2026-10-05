import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { modulesFrom } from "@/i18n/client-graph";

const MAIN_PAGES = [
  "app/[locale]/page.tsx",
  "app/[locale]/learn/page.tsx",
  "app/[locale]/learn/journal/page.tsx",
  "app/[locale]/learn/[station]/[lesson]/page.tsx",
  "app/[locale]/learn/[station]/check/page.tsx",
  "app/[locale]/learn/[station]/exam/page.tsx",
  "app/[locale]/practice/page.tsx",
  "app/[locale]/practice/[lesson]/[activity]/page.tsx",
  "app/[locale]/rafiq/page.tsx",
  "app/[locale]/sources/page.tsx",
  "app/[locale]/talk-to-a-specialist/page.tsx",
  "app/[locale]/privacy/page.tsx",
  "app/[locale]/lens/page.tsx",
  "app/[locale]/mawqif/page.tsx",
  "app/[locale]/mawqif/[situation]/page.tsx",
  "app/[locale]/mawqif/test/[group]/page.tsx",
  "app/[locale]/account/page.tsx",
  "app/[locale]/account/sign-in/page.tsx",
  "app/[locale]/account/sign-up/page.tsx",
];

const WORKING_PARTS = ["components/learn/activities/", "components/learn/interactions/", "components/learn/questions/", "components/learn/board/", "components/guide/guide-panel"];

describe("how the pages are put together", () => {
  it("keeps the home page free of working lesson components", () => {
    const reached = [...modulesFrom("app/[locale]/page.tsx")];
    expect(reached.filter((module) => WORKING_PARTS.some((part) => module.startsWith(part)))).toEqual([]);
  });

  it("opens the tour in Khutuwat only: on the learn page, never from the layout or the home page", () => {
    expect(modulesFrom("app/[locale]/learn/page.tsx")).toContain("components/guide/guide-host.tsx");
    expect(modulesFrom("app/[locale]/layout.tsx")).not.toContain("components/guide/guide-host.tsx");
    expect(modulesFrom("app/[locale]/page.tsx")).not.toContain("components/guide/guide-host.tsx");
  });

  it.each(MAIN_PAGES)("renders %s at build time, failing the build on any request-time API", (page) => {
    const source = readFileSync(path.resolve(__dirname, "..", page), "utf8");
    expect(source).toContain('export const dynamic = "error";');
    if (page.replace("[locale]", "").includes("[")) expect(source).toContain("export function generateStaticParams()");
  });
});
