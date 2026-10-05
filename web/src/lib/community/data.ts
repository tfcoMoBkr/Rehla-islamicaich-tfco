import type { SupabaseClient } from "@supabase/supabase-js";
import * as z from "zod/mini";

import { accountClient } from "@/lib/account/client";

import type { Author, Category, CommunityError, Membership, Post, Reply, ReportReason, Role } from "./types";

/*
 * Reads and writes Rehla Community in the browser, through the Supabase client: a guest reads as
 * anonymous, a member writes as themselves. Every rule (who may write, limits, hidden items) is
 * enforced by the database (supabase/migrations/20261006000000_community.sql); this module only
 * shapes rows and names errors.
 */

type Result<T> = { ok: true; value: T } | { ok: false; error: CommunityError };

const POST_COLUMNS = "id, author, category, title, body, language, needs_specialist, created_at, edited_at, hidden, pinned";
const REPLY_COLUMNS = "id, post, author, body, needs_specialist, created_at, hidden";

const postRow = z.object({
  id: z.string(),
  author: z.nullable(z.string()),
  category: z.enum(["firstSteps", "everydayLife", "encouragement", "learningTogether", "askCommunity"]),
  title: z.string(),
  body: z.string(),
  language: z.enum(["ar", "en"]),
  needs_specialist: z.boolean(),
  created_at: z.string(),
  edited_at: z.nullable(z.string()),
  hidden: z.boolean(),
  pinned: z.boolean(),
});
const replyRow = z.object({
  id: z.string(),
  post: z.string(),
  author: z.nullable(z.string()),
  body: z.string(),
  needs_specialist: z.boolean(),
  created_at: z.string(),
  hidden: z.boolean(),
});
const authorRow = z.object({ user_id: z.string(), name: z.string(), role: z.enum(["member", "moderator", "guide"]), country: z.nullable(z.string()) });
const memberRow = z.object({ name: z.string(), show_country: z.boolean(), role: z.enum(["member", "moderator", "guide"]), joined_at: z.string() });

type ProviderError = { code?: string; message?: string };

/** A database refusal, in the page's terms. */
export function communityError(error: unknown): CommunityError {
  if (error instanceof TypeError) return "network";
  const { code, message } = (error ?? {}) as ProviderError;
  if (message?.includes("community_rate_limit")) return "rateLimited";
  if (code === "23505") return "nameTaken";
  if (code === "42501" || message?.includes("row-level security") || message?.includes("community_moderators_only")) return "notAllowed";
  if (message?.includes("fetch")) return "network";
  return "unknown";
}

async function attempt<T>(run: (client: SupabaseClient) => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await run(await accountClient()) };
  } catch (error) {
    return { ok: false, error: communityError(error) };
  }
}

function must<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

async function signedInUser(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.auth.getSession();
  return data.session?.user.id ?? null;
}

async function authorsOf(client: SupabaseClient, ids: (string | null)[]): Promise<Map<string, Author>> {
  const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
  if (wanted.length === 0) return new Map();
  const rows = z.array(authorRow).parse(must(await client.from("community_authors").select("user_id, name, role, country").in("user_id", wanted)));
  return new Map(rows.map((row) => [row.user_id, { id: row.user_id, name: row.name, role: row.role, country: row.country }]));
}

async function counts(client: SupabaseClient, table: string, column: string, ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = must(await client.from(table).select(column).in(column, ids)) as unknown as Record<string, string>[];
  const found = new Map<string, number>();
  for (const row of rows) found.set(row[column]!, (found.get(row[column]!) ?? 0) + 1);
  return found;
}

/** How many found each item helpful; who did is not readable by others. */
async function helpedCounts(client: SupabaseClient, ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = must(await client.from("community_helped").select("target, helped").in("target", ids)) as { target: string; helped: number }[];
  return new Map(rows.map((row) => [row.target, row.helped]));
}

async function withDetails(client: SupabaseClient, rows: z.infer<typeof postRow>[]): Promise<Post[]> {
  const ids = rows.map((row) => row.id);
  const [authors, helped, replies] = await Promise.all([
    authorsOf(client, rows.map((row) => row.author)),
    helpedCounts(client, ids),
    counts(client, "community_replies", "post", ids),
  ]);
  return rows.map((row) => ({
    id: row.id,
    author: row.author ? (authors.get(row.author) ?? null) : null,
    authorId: row.author,
    category: row.category,
    title: row.title,
    body: row.body,
    language: row.language,
    needsSpecialist: row.needs_specialist,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    hidden: row.hidden,
    pinned: row.pinned,
    helped: helped.get(row.id) ?? 0,
    replies: replies.get(row.id) ?? 0,
  }));
}

export type PostFilter = { category?: Category | null; language?: "ar" | "en" | null };

/** Pinned posts first, then the latest; what the reader may see is decided by the database. */
export function listPosts(filter: PostFilter = {}, limit = 30): Promise<Result<Post[]>> {
  return attempt(async (client) => {
    let query = client.from("community_posts").select(POST_COLUMNS).order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
    if (filter.category) query = query.eq("category", filter.category);
    if (filter.language) query = query.eq("language", filter.language);
    return withDetails(client, z.array(postRow).parse(must(await query)));
  });
}

export type Thread = { post: Post; replies: Reply[]; mine: { helped: Set<string>; me: string | null } };

export function getThread(id: string): Promise<Result<Thread | null>> {
  return attempt(async (client) => {
    const found = z.array(postRow).parse(must(await client.from("community_posts").select(POST_COLUMNS).eq("id", id).limit(1)));
    if (found.length === 0) return null;
    const [post] = await withDetails(client, found);
    const replyRows = z.array(replyRow).parse(must(await client.from("community_replies").select(REPLY_COLUMNS).eq("post", id).order("created_at")));
    const [authors, helped, me] = await Promise.all([
      authorsOf(client, replyRows.map((row) => row.author)),
      helpedCounts(client, replyRows.map((row) => row.id)),
      signedInUser(client),
    ]);
    const mine = new Set<string>();
    if (me) {
      const rows = must(await client.from("community_reactions").select("post, reply").eq("member", me)) as { post: string | null; reply: string | null }[];
      for (const row of rows) mine.add((row.post ?? row.reply)!);
    }
    return {
      post: post!,
      replies: replyRows.map((row) => ({
        id: row.id,
        post: row.post,
        author: row.author ? (authors.get(row.author) ?? null) : null,
        authorId: row.author,
        body: row.body,
        needsSpecialist: row.needs_specialist,
        createdAt: row.created_at,
        hidden: row.hidden,
        helped: helped.get(row.id) ?? 0,
      })),
      mine: { helped: mine, me },
    };
  });
}

/** The reader's membership: null when signed in but not joined, undefined when not signed in. */
export function myMembership(): Promise<Result<Membership | null | undefined>> {
  return attempt(async (client) => {
    const me = await signedInUser(client);
    if (!me) return undefined;
    const rows = z.array(memberRow).parse(must(await client.from("community_members").select("name, show_country, role, joined_at").eq("user_id", me)));
    const row = rows[0];
    return row ? { name: row.name, showCountry: row.show_country, role: row.role as Role, joinedAt: row.joined_at } : null;
  });
}

async function requireMe(client: SupabaseClient): Promise<string> {
  const me = await signedInUser(client);
  if (!me) throw Object.assign(new Error("not signed in"), { code: "42501" });
  return me;
}

export const join = (name: string, showCountry: boolean) =>
  attempt(async (client) => {
    const me = await requireMe(client);
    must(await client.from("community_members").insert({ user_id: me, name: name.trim(), show_country: showCountry }).select("user_id"));
    return true;
  });

export const updateMembership = (name: string, showCountry: boolean) =>
  attempt(async (client) => {
    const me = await requireMe(client);
    must(await client.from("community_members").update({ name: name.trim(), show_country: showCountry }).eq("user_id", me).select("user_id"));
    return true;
  });

/** Leaving deletes the member's posts and replies, or keeps them as a former member's. */
export const leave = (keepPosts: boolean) =>
  attempt(async (client) => {
    must(await client.rpc("community_leave", { keep_posts: keepPosts }));
    return true;
  });

export type Draft = { category: Category; title: string; body: string; language: "ar" | "en"; needsSpecialist: boolean };

export const createPost = (draft: Draft) =>
  attempt(async (client) => {
    const me = await requireMe(client);
    const rows = must(
      await client
        .from("community_posts")
        .insert({ author: me, category: draft.category, title: draft.title.trim(), body: draft.body.trim(), language: draft.language, needs_specialist: draft.needsSpecialist })
        .select("id"),
    ) as { id: string }[];
    return rows[0]!.id;
  });

export const createReply = (post: string, body: string, needsSpecialist: boolean) =>
  attempt(async (client) => {
    const me = await requireMe(client);
    must(await client.from("community_replies").insert({ post, author: me, body: body.trim(), needs_specialist: needsSpecialist }).select("id"));
    return true;
  });

export const setHelped = (target: { post?: string; reply?: string }, helped: boolean) =>
  attempt(async (client) => {
    const me = await requireMe(client);
    if (helped) must(await client.from("community_reactions").insert({ member: me, ...target }).select("id"));
    else {
      const column = target.post ? "post" : "reply";
      must(await client.from("community_reactions").delete().eq("member", me).eq(column, (target.post ?? target.reply)!).select("id"));
    }
    return true;
  });

export const report = (type: "post" | "reply", id: string, reason: ReportReason) =>
  attempt(async (client) => {
    const me = await requireMe(client);
    const { error } = await client.from("community_reports").insert({ target_type: type, target_id: id, reporter: me, reason });
    // Reporting the same thing twice is not an error to the reporter.
    if (error && error.code !== "23505") throw error;
    return true;
  });

/** The member's own posts, for "My posts" and the data export. */
export const myPosts = () =>
  attempt(async (client) => {
    const me = await requireMe(client);
    return withDetails(client, z.array(postRow).parse(must(await client.from("community_posts").select(POST_COLUMNS).eq("author", me).order("created_at", { ascending: false }))));
  });

export type ReviewItem = { type: "post" | "reply"; id: string; post: string; title: string | null; body: string; hidden: boolean; pinned: boolean; reports: ReportReason[] };

/** For moderators: hidden items and reported ones, with the reasons given. */
export const reviewList = () =>
  attempt(async (client) => {
    const reports = must(await client.from("community_reports").select("target_type, target_id, reason")) as { target_type: "post" | "reply"; target_id: string; reason: ReportReason }[];
    const reported = (type: "post" | "reply") => reports.filter((row) => row.target_type === type).map((row) => row.target_id);
    const posts = z.array(postRow).parse(must(await client.from("community_posts").select(POST_COLUMNS).or(`hidden.eq.true${reported("post").length ? `,id.in.(${reported("post").join(",")})` : ""}`)));
    const replies = z.array(replyRow).parse(must(await client.from("community_replies").select(REPLY_COLUMNS).or(`hidden.eq.true${reported("reply").length ? `,id.in.(${reported("reply").join(",")})` : ""}`)));
    const reasons = (type: "post" | "reply", id: string) => reports.filter((row) => row.target_type === type && row.target_id === id).map((row) => row.reason);
    const items: ReviewItem[] = [
      ...posts.map((row) => ({ type: "post" as const, id: row.id, post: row.id, title: row.title, body: row.body, hidden: row.hidden, pinned: row.pinned, reports: reasons("post", row.id) })),
      ...replies.map((row) => ({ type: "reply" as const, id: row.id, post: row.post, title: null, body: row.body, hidden: row.hidden, pinned: false, reports: reasons("reply", row.id) })),
    ];
    return items;
  });

export const moderate = (item: { type: "post" | "reply"; id: string }, change: { hidden?: boolean; pinned?: boolean; clearReports?: boolean }) =>
  attempt(async (client) => {
    const table = item.type === "post" ? "community_posts" : "community_replies";
    const values = { ...(change.hidden === undefined ? {} : { hidden: change.hidden }), ...(change.pinned === undefined ? {} : { pinned: change.pinned }) };
    if (Object.keys(values).length) must(await client.from(table).update(values).eq("id", item.id).select("id"));
    if (change.clearReports) must(await client.from("community_reports").delete().eq("target_type", item.type).eq("target_id", item.id).select("id"));
    return true;
  });
