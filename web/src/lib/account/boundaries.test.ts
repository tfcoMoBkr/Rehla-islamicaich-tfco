import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { modulesFrom } from "@/i18n/client-graph";

/*
 * What an account must never reach: the AI service never receives the display name or anything
 * from the account, and the server-only key stays in one server module.
 */

const SRC = path.resolve(__dirname, "../..");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

const files = sources(SRC).map((file) => ({ file: path.relative(SRC, file).replaceAll("\\", "/"), text: readFileSync(file, "utf8") }));

/** Everything that builds or sends a request to the AI service. */
const AI_CALLERS = ["lib/rafiq/ask.ts", "lib/rafiq/lesson-help.ts", "lib/rafiq/answer.ts", "lib/lens/lens.ts", "lib/lens/conversation.ts", "lib/mawqif/practice.ts", "lib/mawqif/evaluate.ts", "lib/ai-proxy.ts", "app/api/ai/[path]/route.ts"];

describe("what an account never reaches", () => {
  it("keeps the account out of every request to the AI service", () => {
    for (const caller of AI_CALLERS) {
      const reached = [...modulesFrom(caller)];
      expect(reached.filter((module) => module.startsWith("lib/account/") || module.startsWith("components/account/"))).toEqual([]);
    }
  });

  it("never puts the display name in a module that talks to the AI service", () => {
    const naming = files.filter(({ text }) => /display_name|displayName|accountSummary|useAccount\(/.test(text));
    expect(naming.length).toBeGreaterThan(0);
    const talking = naming.filter(({ text }) => /\/api\/ai|askRafiq|requestLessonHelp|postToRafiq|callAiService/.test(text));
    expect(talking.map(({ file }) => file)).toEqual([]);
  });

  it("reads the secret key in one server-only module, reached by no page", () => {
    const readers = files.filter(({ text }) => text.includes("SUPABASE_SECRET_KEY")).map(({ file }) => file);
    expect(readers).toEqual(["lib/account/admin.ts"]);
    expect(readFileSync(path.join(SRC, "lib/account/admin.ts"), "utf8")).toMatch(/^import "server-only";/);
    expect(files.some(({ text }) => /NEXT_PUBLIC_SUPABASE_SECRET|NEXT_PUBLIC_SUPABASE_SERVICE/.test(text))).toBe(false);

    const pages = files.filter(({ file }) => /^app\/.*(page|layout)\.tsx$/.test(file));
    for (const { file } of pages) expect([...modulesFrom(file)]).not.toContain("lib/account/admin.ts");
  });

  it("keeps the database free of sensitive fields", () => {
    const migrations = path.resolve(SRC, "../../supabase/migrations");
    const sql = readdirSync(migrations)
      .map((name) => readFileSync(path.join(migrations, name), "utf8"))
      .join("\n")
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .toLowerCase();
    for (const word of ["religio", "conversion", "convert", "faith", "family", "health", "gender", "birth", " age ", "ip_address", "location"]) {
      expect(sql).not.toContain(word);
    }
  });
});
