import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../messages/en.json";
import ar from "../../../messages/ar.json";

/*
 * The account flows against a Supabase client faked in memory: no network, no project. The fake
 * keeps the session where supabase-js would (localStorage, under our storage key) and holds the
 * two tables as maps.
 */

type Row = { user_id: string; item_id: string; kind: string; value: unknown; updated_at: string };
type Profile = { display_name: string; country: string | null; locale: string; created_at: string; updated_at: string };
type Result = { data: unknown; error: { message: string } | null };

const AUTH_KEY = "rehla.auth.v1";
const storage = new Map<string, string>();
const fakeWindow = {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  },
  location: { origin: "https://rehla.example" },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  scrollTo: () => undefined,
};
vi.stubGlobal("window", fakeWindow);
const network = { online: true };
vi.stubGlobal("navigator", {
  get onLine() {
    return network.online;
  },
});

const db = {
  rows: new Map<string, Row>(),
  profiles: new Map<string, Profile>(),
  users: new Map<string, { id: string; email: string; password: string }>(),
};

const now = () => new Date(0).toISOString();
const failure: Result = { data: null, error: { message: "TypeError: fetch failed" } };

class Query implements PromiseLike<Result> {
  private filters: Array<(row: Record<string, unknown>) => boolean> = [];
  private action: { kind: "select" } | { kind: "upsert"; rows: Row[] } | { kind: "update"; values: Partial<Profile> } | { kind: "delete" } = { kind: "select" };
  private window: [number, number] | null = null;
  private single = false;

  constructor(private table: "profiles" | "progress_items") {}

  select() {
    return this;
  }
  order() {
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }
  range(from: number, to: number) {
    this.window = [from, to];
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this;
  }
  upsert(rows: Row[]) {
    this.action = { kind: "upsert", rows };
    return this;
  }
  update(values: Partial<Profile>) {
    this.action = { kind: "update", values };
    return this;
  }
  delete() {
    this.action = { kind: "delete" };
    return this;
  }

  private run(): Result {
    if (!network.online) return failure;
    if (this.table === "profiles") {
      const entries = [...db.profiles.entries()].filter(([id, profile]) => this.filters.every((keep) => keep({ id, ...profile })));
      if (this.action.kind === "update") {
        for (const [id, profile] of entries) db.profiles.set(id, { ...profile, ...this.action.values });
        return { data: null, error: null };
      }
      const found = entries.map(([, profile]) => profile);
      return { data: this.single ? (found[0] ?? null) : found, error: null };
    }
    const key = (row: { user_id: string; item_id: string }) => `${row.user_id}|${row.item_id}`;
    if (this.action.kind === "upsert") {
      for (const row of this.action.rows) db.rows.set(key(row), { ...row, updated_at: now() });
      return { data: null, error: null };
    }
    const matching = [...db.rows.values()].filter((row) => this.filters.every((keep) => keep(row)));
    if (this.action.kind === "delete") {
      matching.forEach((row) => db.rows.delete(key(row)));
      return { data: null, error: null };
    }
    const [from, to] = this.window ?? [0, matching.length];
    return { data: matching.slice(from, to + 1), error: null };
  }

  then<A = Result, B = never>(onFulfilled?: ((value: Result) => A | PromiseLike<A>) | null, onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve(this.run()).then(onFulfilled, onRejected);
  }
}

const session = () => {
  const raw = storage.get(AUTH_KEY);
  return raw ? (JSON.parse(raw) as { access_token: string; user: { id: string; email: string } }) : null;
};
const begin = (user: { id: string; email: string }) => {
  const value = { access_token: `token-${user.id}`, user: { id: user.id, email: user.email, created_at: now() } };
  storage.set(AUTH_KEY, JSON.stringify(value));
  return value;
};

const auth = {
  signUp: vi.fn(async ({ email, password, options }: { email: string; password: string; options: { data: Record<string, string | null> } }) => {
    if ([...db.users.values()].some((user) => user.email === email)) return { data: { user: null, session: null }, error: { name: "AuthApiError", code: "user_already_exists", status: 422 } };
    const user = { id: `user-${db.users.size + 1}`, email, password };
    db.users.set(user.id, user);
    // What the migration's trigger does on sign-up.
    db.profiles.set(user.id, {
      display_name: String(options.data.display_name),
      country: options.data.country ?? null,
      locale: String(options.data.locale),
      created_at: now(),
      updated_at: now(),
    });
    const started = begin(user);
    return { data: { user: started.user, session: started }, error: null };
  }),
  signInWithPassword: vi.fn(async ({ email, password }: { email: string; password: string }) => {
    const user = [...db.users.values()].find((candidate) => candidate.email === email && candidate.password === password);
    if (!user) return { data: { user: null, session: null }, error: { name: "AuthApiError", code: "invalid_credentials", status: 400 } };
    const started = begin(user);
    return { data: { user: started.user, session: started }, error: null };
  }),
  signOut: vi.fn(async () => {
    storage.delete(AUTH_KEY);
    return { error: null };
  }),
  getSession: vi.fn(async () => ({ data: { session: session() } })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: () => undefined } } })),
  updateUser: vi.fn(async () => ({ data: {}, error: null })),
};

const createClient = vi.fn(() => ({ auth, from: (table: "profiles" | "progress_items") => new Query(table) }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
  usePathname: () => "/learn",
}));

const { progressActions, readProgress } = await import("@/lib/learn/progress-store");
const { provisionsOf } = await import("@/lib/learn/progress");
const { tourSeen } = await import("@/lib/guide-store");
const { learnerName, conversationStore } = await import("@/lib/rafiq/memory");
const { deleteAccount, signIn, signOut, signUp, updateProfile } = await import("./actions");
const { accountSummary } = await import("./session");
const { flush, stopSync } = await import("./sync");
const { accountError } = await import("./errors");
const { AccountEntry } = await import("@/components/account/account-entry");
const { AccountInvite, inviteDismissed, shouldInvite } = await import("@/components/account/account-invite");

const render = (node: ReactNode, locale: "ar" | "en" = "en") =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? en : ar}>
      {node}
    </NextIntlClientProvider>,
  );

const rowsOf = (userId: string) =>
  Object.fromEntries([...db.rows.values()].filter((row) => row.user_id === userId).map((row) => [row.item_id, row.value]));

function configure() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
}

beforeEach(() => {
  storage.clear();
  db.rows.clear();
  db.profiles.clear();
  db.users.clear();
  network.online = true;
  progressActions.forget();
  vi.clearAllMocks();
});

afterEach(() => {
  stopSync();
  vi.unstubAllEnvs();
});

describe("without the Supabase variables", () => {
  it("leaves the guest flow exactly as it was: no entry, no invitation, no client", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    progressActions.completeLesson("1.1");
    progressActions.earn("question:q-1", 1);

    expect(render(<AccountEntry />)).toBe("");
    expect(render(<AccountInvite />)).toBe("");
    expect(shouldInvite({ signedIn: false, dismissed: false, completedLessons: 1 })).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
    expect([...storage.keys()]).toEqual(["rehla.journey.v1"]);
    expect(readProgress().completedLessons).toHaveProperty("1.1");
  });
});

describe("with accounts", () => {
  beforeEach(configure);

  it("offers a quiet way in from the header", () => {
    expect(render(<AccountEntry />)).toContain(">Sign in<");
    expect(render(<AccountEntry />, "ar")).toContain(">سجّل الدخول<");
    expect(render(<AccountEntry />)).toContain('href="/account/sign-in"');
  });

  it("invites a guest once, after the first completed lesson, until dismissed", () => {
    const guest = { signedIn: false, dismissed: false, completedLessons: 1 };
    expect(shouldInvite(guest)).toBe(true);
    expect(shouldInvite({ ...guest, completedLessons: 0 })).toBe(false);
    expect(shouldInvite({ ...guest, dismissed: true })).toBe(false);
    expect(shouldInvite({ ...guest, signedIn: true })).toBe(false);
    // Rendered on the server (and before hydration), the page shows no invitation at all.
    progressActions.completeLesson("1.1");
    expect(render(<AccountInvite />)).toBe("");
  });

  it("signs up with only a display name, a country and the language, and keeps the guest's progress", async () => {
    progressActions.completeLesson("1.1");
    progressActions.earn("activity:1.1:a1", 2);
    progressActions.setChecklist("1.6:list", ["a"]);
    tourSeen.mark();

    const result = await signUp({ email: "a@example.com", password: "long enough", displayName: "Amina", country: "SA", locale: "ar" });

    expect(result).toEqual({ ok: true, signedIn: true });
    const [{ options }] = auth.signUp.mock.calls[0]!;
    expect(options.data).toEqual({ display_name: "Amina", country: "SA", locale: "ar" });
    expect(db.profiles.get("user-1")).toMatchObject({ display_name: "Amina", country: "SA", locale: "ar" });
    expect(Object.keys(rowsOf("user-1")).sort()).toEqual(["earned:activity:1.1:a1", "lesson:1.1", "tour"]);
    expect(readProgress().completedLessons).toHaveProperty("1.1");
    expect(readProgress().checklists).toEqual({ "1.6:list": ["a"] });
    expect(accountSummary.read()).toEqual({ name: "Amina", country: "SA" });
  });

  it("refuses a country the list does not offer, before anything is sent", async () => {
    expect(await signUp({ email: "a@example.com", password: "long enough", displayName: "Amina", country: "IL", locale: "en" })).toEqual({
      ok: false,
      error: "countryNotListed",
    });
    expect(auth.signUp).not.toHaveBeenCalled();

    await signUp({ email: "a@example.com", password: "long enough", displayName: "Amina", country: "SA", locale: "en" });
    expect(await updateProfile("Amina", "IL", "en")).toEqual({ ok: false, error: "countryNotListed" });
    expect(db.profiles.get("user-1")?.country).toBe("SA");
    expect(accountSummary.read()?.country).toBe("SA");

    expect(await updateProfile("Amina", "PS", "en")).toEqual({ ok: true });
    expect(db.profiles.get("user-1")?.country).toBe("PS");
  });

  it("says plainly when the email is already used", async () => {
    await signUp({ email: "a@example.com", password: "long enough", displayName: "Amina", country: null, locale: "en" });
    await signOut();
    expect(await signUp({ email: "a@example.com", password: "long enough", displayName: "B", country: null, locale: "en" })).toEqual({ ok: false, error: "emailUsed" });
  });

  it("joins this device with the account on sign-in, counting provisions once", async () => {
    await signUp({ email: "a@example.com", password: "long enough", displayName: "Amina", country: null, locale: "en" });
    progressActions.completeLesson("1.1");
    progressActions.earn("question:q-1", 1);
    progressActions.earn("question:q-2", 1);
    expect(await flush()).toBe(true);
    await signOut();
    expect(provisionsOf(readProgress())).toBe(0);

    // On another device (or as a guest again): one provision in common, one new.
    progressActions.earn("question:q-2", 1);
    progressActions.earn("question:q-3", 1);
    progressActions.completeLesson("1.2");
    expect(await signIn("a@example.com", "wrong password")).toEqual({ ok: false, error: "wrongPassword" });
    expect(await signIn("a@example.com", "long enough")).toEqual({ ok: true });

    const progress = readProgress();
    expect(Object.keys(progress.practice.earned).sort()).toEqual(["question:q-1", "question:q-2", "question:q-3"]);
    expect(provisionsOf(progress)).toBe(3);
    expect(Object.keys(progress.completedLessons).sort()).toEqual(["1.1", "1.2"]);
    expect(Object.keys(rowsOf("user-1")).sort()).toEqual(["earned:question:q-1", "earned:question:q-2", "earned:question:q-3", "lesson:1.1", "lesson:1.2"]);
  });

  it("sends what is waiting before signing out, then clears the account's data from the device", async () => {
    await signUp({ email: "a@example.com", password: "long enough", displayName: "Amina", country: null, locale: "en" });
    progressActions.completeLesson("2.1");
    learnerName.set("Amina");
    conversationStore("en").set([]);
    storage.set("rehla:board-sounds", "off");
    inviteDismissed.set("dismissed");

    expect(await signOut()).toEqual({ ok: true });

    expect(rowsOf("user-1")).toHaveProperty("lesson:2.1");
    expect(readProgress().completedLessons).toEqual({});
    expect(tourSeen.read()).toBe(false);
    expect([...storage.keys()].sort()).toEqual(["rehla.invite.v1", "rehla:board-sounds"]);
  });

  it("does not sign out silently while changes cannot be sent", async () => {
    await signUp({ email: "a@example.com", password: "long enough", displayName: "Amina", country: null, locale: "en" });
    network.online = false;
    progressActions.completeLesson("3.1");

    expect(await signOut()).toEqual({ ok: false, error: "unsaved" });
    expect(readProgress().completedLessons).toHaveProperty("3.1");
    expect(storage.has(AUTH_KEY)).toBe(true);

    network.online = true;
    expect(await signOut()).toEqual({ ok: true });
    expect(rowsOf("user-1")).toHaveProperty("lesson:3.1");
  });

  it("erases the journal from the account too when the learner erases it while signed in", async () => {
    await signUp({ email: "a@example.com", password: "long enough", displayName: "Amina", country: null, locale: "en" });
    progressActions.completeLesson("1.1");
    await flush();
    progressActions.forget();
    await flush();
    expect(rowsOf("user-1")).toEqual({});
  });

  it("never empties the account when another tab signs out and clears the device", async () => {
    await signUp({ email: "a@example.com", password: "long enough", displayName: "Amina", country: null, locale: "en" });
    progressActions.completeLesson("1.1");
    await flush();
    storage.delete(AUTH_KEY);
    progressActions.forget();
    await flush();
    expect(rowsOf("user-1")).toHaveProperty("lesson:1.1");
  });

  it("deletes the account through the server with the session token, then clears everything", async () => {
    await signUp({ email: "a@example.com", password: "long enough", displayName: "Amina", country: null, locale: "en" });
    progressActions.completeLesson("1.1");
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));

    expect(await deleteAccount()).toEqual({ ok: true });

    expect(fetch).toHaveBeenCalledWith("/api/account/delete", { method: "POST", headers: { authorization: "Bearer token-user-1" } });
    expect(storage.has(AUTH_KEY)).toBe(false);
    expect(readProgress().completedLessons).toEqual({});
    expect(accountSummary.read()).toBeNull();
    fetch.mockRestore();
  });

  it("keeps everything when the server cannot delete the account", async () => {
    await signUp({ email: "a@example.com", password: "long enough", displayName: "Amina", country: null, locale: "en" });
    progressActions.completeLesson("1.1");
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 503 }));

    expect(await deleteAccount()).toEqual({ ok: false, error: "unknown" });
    expect(storage.has(AUTH_KEY)).toBe(true);
    expect(readProgress().completedLessons).toHaveProperty("1.1");
    fetch.mockRestore();
  });
});

describe("the account's error messages", () => {
  it("turn provider errors into kind words, never the provider's own text", () => {
    expect(accountError({ name: "AuthApiError", code: "invalid_credentials", status: 400, message: "Invalid login credentials" })).toBe("wrongPassword");
    expect(accountError({ name: "AuthApiError", code: "user_already_exists", status: 422 })).toBe("emailUsed");
    expect(accountError({ name: "AuthWeakPasswordError", code: "weak_password", status: 422 })).toBe("weakPassword");
    expect(accountError({ name: "AuthRetryableFetchError", status: 0 })).toBe("network");
    expect(accountError(new TypeError("Failed to fetch"))).toBe("network");
    expect(accountError({ name: "AuthApiError", code: "something_new", status: 500 })).toBe("unknown");
    // The database's own refusal of a country (a check constraint) reads the same as the app's.
    expect(accountError({ code: "23514", message: "violates check constraint \"profiles_country_not_il\"" })).toBe("countryNotListed");
  });

  it("exist in both languages for every error", () => {
    const keys = ["wrongPassword", "currentPasswordWrong", "emailUsed", "weakPassword", "samePassword", "badEmail", "countryNotListed", "notConfirmed", "tooMany", "sessionEnded", "network", "unknown"];
    for (const messages of [en, ar]) expect(Object.keys(messages.Account.errors)).toEqual(expect.arrayContaining(keys));
  });
});
