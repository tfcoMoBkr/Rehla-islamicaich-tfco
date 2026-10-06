import { beforeEach, describe, expect, it, vi } from "vitest";

import { advance, checkText, noticesFor, personalData, STOPS, type ServiceCheck } from "./checks";

/*
 * A stand-in for the Supabase client: each query records what it was asked and answers from
 * `answers`, keyed by table (or "rpc:<name>").
 */
type Call = { table: string; steps: [string, unknown[]][] };
const calls: Call[] = [];
let answers: Record<string, { data: unknown; error: unknown } | ((call: Call) => { data: unknown; error: unknown })> = {};
let session: { user: { id: string } } | null = { user: { id: "me" } };

function query(table: string) {
  const call: Call = { table, steps: [] };
  calls.push(call);
  const builder: Record<string, unknown> = {};
  for (const step of ["select", "insert", "update", "delete", "eq", "in", "or", "order", "limit"]) {
    builder[step] = (...args: unknown[]) => {
      call.steps.push([step, args]);
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => void) => {
    const answer = answers[table] ?? { data: [], error: null };
    resolve(typeof answer === "function" ? answer(call) : answer);
  };
  return builder;
}

const client = {
  auth: { getSession: async () => ({ data: { session } }) },
  from: query,
  rpc: (name: string, args: unknown) => {
    const builder = query(`rpc:${name}`);
    return (builder.select as (value: unknown) => unknown)(args);
  },
};

vi.mock("@/lib/account/client", () => ({ accountClient: async () => client }));

const data = await import("./data");

beforeEach(() => {
  calls.length = 0;
  answers = {};
  session = { user: { id: "me" } };
});

const step = (call: Call | undefined, name: string) => call?.steps.find(([given]) => given === name)?.[1];

const service = (flags: Partial<ServiceCheck> = {}): ServiceCheck => ({ checked: true, danger: false, distress: false, personalRuling: false, religiousClaim: false, ...flags });

describe("the checks before sharing", () => {
  it("finds phone numbers, emails and addresses, in Arabic and English digits", () => {
    expect(personalData("call me on +966 50 123 4567")).toEqual(["phone"]);
    expect(personalData("رقمي ٠٥٠١٢٣٤٥٦٧")).toEqual(["phone"]);
    expect(personalData("write to sara@example.com")).toEqual(["email"]);
    expect(personalData("I live at 12 Baker Street")).toEqual(["address"]);
    expect(personalData("أسكن في شارع الملك فهد")).toEqual(["address"]);
    expect(personalData("I prayed for 3 days in a row and it felt calm")).toEqual([]);
  });

  it("orders the notices: danger or distress, then personal data, then a ruling", () => {
    const notices = noticesFor("my number is 0501234567", service({ distress: true, personalRuling: true }));
    expect(notices.map((notice) => notice.kind)).toEqual(["care", "personalData", "ruling"]);
    expect(noticesFor("hello", service({ danger: true }))).toEqual([{ kind: "care", danger: true }]);
    expect(noticesFor("hello", service())).toEqual([]);
  });

  it("lets the writer pass every notice, and tags the post when they choose the specialist tag", () => {
    const notices = noticesFor("0501234567", service({ personalRuling: true }));
    const second = advance({ notices, index: 0, tagged: false });
    expect(second).toMatchObject({ index: 1, tagged: false });
    expect(advance(second as never, true)).toEqual({ share: true, needsSpecialist: true });
    expect(advance({ notices: notices.slice(0, 1), index: 0, tagged: false })).toEqual({ share: true, needsSpecialist: false });
  });

  it("holds a post that could not be checked, and stops one that rules or quotes scripture", () => {
    expect(noticesFor("Hello all", { ...service(), checked: false })).toEqual([{ kind: "held" }]);
    expect(noticesFor("Music is haram.", service({ religiousClaim: true, personalRuling: true }))).toEqual([{ kind: "religious" }]);
    expect(STOPS.has("religious") && STOPS.has("held")).toBe(true);
  });

  it("asks the service once, and reports when it cannot answer", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ checked: true, danger: false, distress: false, personalRuling: true })));
    expect(await checkText("  Is my job allowed for me?  ", "en", fetcher)).toEqual(service({ personalRuling: true }));
    expect(fetcher).toHaveBeenCalledWith("/api/ai/community-check", expect.objectContaining({ body: JSON.stringify({ text: "Is my job allowed for me?", locale: "en" }) }));

    const unchecked = { checked: false, danger: false, distress: false, personalRuling: false, religiousClaim: false };
    expect(await checkText("x", "ar", async () => new Response("", { status: 503 }))).toEqual(unchecked);
    expect(await checkText("x", "ar", async () => new Response("not json"))).toEqual(unchecked);
    expect(
      await checkText("x", "ar", async () => {
        throw new TypeError("offline");
      }),
    ).toEqual(unchecked);
  });
});

describe("reading the community", () => {
  it("shows writers by community name and badge, and a post whose writer left as a former member's", async () => {
    const row = { category: "encouragement", body: "b", language: "ar", needs_specialist: false, created_at: "2026-10-05T10:00:00Z", edited_at: null, hidden: false, pinned: false, is_sample: false };
    answers.community_posts = { data: [{ ...row, id: "p1", author: "u1", title: "One" }, { ...row, id: "p2", author: null, title: "Two" }], error: null };
    answers.community_authors = { data: [{ user_id: "u1", name: "Noor", role: "guide", country: null }], error: null };
    answers.community_helped = { data: [{ target: "p1", helped: 2 }], error: null };
    answers.community_replies = { data: [{ post: "p2" }], error: null };

    const result = await data.listPosts({ category: "encouragement", language: "ar" });
    expect(result.ok && result.value.map((post) => [post.author?.name ?? null, post.author?.role ?? null, post.helped, post.replies])).toEqual([
      ["Noor", "guide", 2, 0],
      [null, null, 0, 1],
    ]);
    const posts = calls.find((call) => call.table === "community_posts");
    expect(posts?.steps.filter(([name]) => name === "eq").map(([, args]) => args)).toEqual([
      ["category", "encouragement"],
      ["language", "ar"],
    ]);
    // The author view is asked only for the writers on the page.
    expect(step(calls.find((call) => call.table === "community_authors"), "in")).toEqual(["user_id", ["u1"]]);
  });

  it("names a guest's membership as signed out without asking the database", async () => {
    session = null;
    expect(await data.myMembership()).toEqual({ ok: true, value: undefined });
    expect(calls).toEqual([]);
  });

  it("names database refusals in the page's terms", () => {
    expect(data.communityError({ code: "P0001", message: "community_rate_limit" })).toBe("rateLimited");
    expect(data.communityError({ code: "23505", message: "duplicate key" })).toBe("nameTaken");
    expect(data.communityError({ code: "42501", message: "new row violates row-level security policy" })).toBe("notAllowed");
    expect(data.communityError(new TypeError("Failed to fetch"))).toBe("network");
    expect(data.communityError({ code: "XX000" })).toBe("unknown");
  });
});

describe("writing to the community", () => {
  it("joins with the chosen name, trimmed, and the country switch", async () => {
    expect(await data.join("  Noor  ", true)).toEqual({ ok: true, value: true });
    expect(step(calls[0], "insert")).toEqual([{ user_id: "me", name: "Noor", show_country: true }]);
  });

  it("reports a taken name", async () => {
    answers.community_members = { data: null, error: { code: "23505", message: "duplicate" } };
    expect(await data.join("Noor", false)).toEqual({ ok: false, error: "nameTaken" });
  });

  it("writes a post as the signed-in member, with the specialist tag when chosen", async () => {
    answers.community_posts = { data: [{ id: "new" }], error: null };
    const draft = { category: "askCommunity", title: " T ", body: " B ", language: "en", needsSpecialist: true } as const;
    expect(await data.createPost(draft)).toEqual({ ok: true, value: "new" });
    expect(step(calls[0], "insert")).toEqual([{ author: "me", category: "askCommunity", title: "T", body: "B", language: "en", needs_specialist: true }]);
  });

  it("says when the hourly limit is reached", async () => {
    answers.community_replies = { data: null, error: { code: "P0001", message: "community_rate_limit", hint: "replies" } };
    expect(await data.createReply("p1", "hello", false)).toEqual({ ok: false, error: "rateLimited" });
  });

  it("gives and takes back “this helped me”", async () => {
    await data.setHelped({ post: "p1" }, true);
    await data.setHelped({ reply: "r1" }, false);
    expect(step(calls[0], "insert")).toEqual([{ member: "me", post: "p1" }]);
    expect(calls[1]?.steps.filter(([name]) => name === "eq").map(([, args]) => args)).toEqual([
      ["member", "me"],
      ["reply", "r1"],
    ]);
  });

  it("files a report with its reason, and treats a second report of the same thing as done", async () => {
    expect(await data.report("reply", "r1", "personalData")).toEqual({ ok: true, value: true });
    expect(step(calls[0], "insert")).toEqual([{ target_type: "reply", target_id: "r1", reporter: "me", reason: "personalData" }]);
    answers.community_reports = { data: null, error: { code: "23505" } };
    expect(await data.report("reply", "r1", "spam")).toEqual({ ok: true, value: true });
  });

  it("leaves through the database function, keeping or deleting what was written", async () => {
    await data.leave(true);
    await data.leave(false);
    expect(calls.map((call) => [call.table, step(call, "select")])).toEqual([
      ["rpc:community_leave", [{ keep_posts: true }]],
      ["rpc:community_leave", [{ keep_posts: false }]],
    ]);
  });

  it("refuses to write for a guest", async () => {
    session = null;
    expect(await data.createReply("p1", "hello", false)).toEqual({ ok: false, error: "notAllowed" });
    expect(calls).toEqual([]);
  });
});
