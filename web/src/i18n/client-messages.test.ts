import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { clientNamespaces } from "./client-graph";
import { LAYOUT_NAMESPACES, PAGE_NAMESPACES, type ClientPage } from "./client-namespaces";

const PAGE_FILES: Record<ClientPage, string> = {
  home: "app/[locale]/page.tsx",
  learn: "app/[locale]/learn/page.tsx",
  journal: "app/[locale]/learn/journal/page.tsx",
  lesson: "app/[locale]/learn/[station]/[lesson]/page.tsx",
  check: "app/[locale]/learn/[station]/check/page.tsx",
  exam: "app/[locale]/learn/[station]/exam/page.tsx",
  rafiq: "app/[locale]/rafiq/page.tsx",
  practice: "app/[locale]/practice/page.tsx",
  practiceRound: "app/[locale]/practice/[lesson]/[activity]/page.tsx",
  sources: "app/[locale]/sources/page.tsx",
  specialists: "app/[locale]/talk-to-a-specialist/page.tsx",
  account: "app/[locale]/account/page.tsx",
  signIn: "app/[locale]/account/sign-in/page.tsx",
  signUp: "app/[locale]/account/sign-up/page.tsx",
  privacy: "app/[locale]/privacy/page.tsx",
  lens: "app/[locale]/lens/page.tsx",
  mawqif: "app/[locale]/mawqif/page.tsx",
  situation: "app/[locale]/mawqif/[situation]/page.tsx",
  mawqifTest: "app/[locale]/mawqif/test/[group]/page.tsx",
  community: "app/[locale]/community/page.tsx",
  communityPost: "app/[locale]/community/post/page.tsx",
  communityWrite: "app/[locale]/community/write/page.tsx",
  communityReview: "app/[locale]/community/review/page.tsx",
};

const missing = (needed: Set<string>, sent: readonly string[]) => [...needed].filter((namespace) => !sent.includes(namespace)).sort();

describe("the messages each page sends to the browser", () => {
  it("cover every namespace the layout's client components read", () => {
    const layout = new Set([
      ...clientNamespaces("app/[locale]/layout.tsx"),
      ...clientNamespaces("app/[locale]/error.tsx"),
      ...clientNamespaces("app/[locale]/not-found.tsx"),
      ...clientNamespaces("app/[locale]/loading.tsx"),
    ]);
    expect(missing(layout, LAYOUT_NAMESPACES)).toEqual([]);
  });

  it.each(Object.entries(PAGE_FILES))("cover every namespace the %s page's client components read", (page, file) => {
    const sent = [...LAYOUT_NAMESPACES, ...PAGE_NAMESPACES[page as ClientPage]];
    expect(missing(clientNamespaces(file), sent)).toEqual([]);
    expect(readFileSync(path.resolve(__dirname, "..", file), "utf8")).toContain(`<PageMessages page="${page}">`);
  });
});
