import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { accountChoice, choiceNeeded, choose, inLearningSection, offersChoice, tourMayOpen } from "./choice";
import { accountSummary, AUTH_STORAGE_KEY } from "./session";

const storage = new Map<string, string>();
vi.stubGlobal("window", {
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  },
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
});

const guest = { enabled: true, signedIn: false, chosen: false, pathname: "/learn" };

// Each store keeps an in-memory copy too, so they are reset through their own setters.
function reset() {
  accountChoice.set(null);
  accountSummary.set(null);
  storage.clear();
}

beforeEach(reset);
afterEach(() => vi.unstubAllEnvs());

describe("the account-or-guest choice", () => {
  it("is offered to a guest who has not chosen, in Khutuwat, Practice and Rafiq only", () => {
    for (const pathname of ["/learn", "/learn/1/1-1", "/practice", "/practice/1.1/a1", "/rafiq"]) {
      expect(offersChoice({ ...guest, pathname })).toBe(true);
    }
    for (const pathname of ["/", "/sources", "/account", "/learning", "/privacy"]) {
      expect(inLearningSection(pathname)).toBe(false);
      expect(offersChoice({ ...guest, pathname })).toBe(false);
    }
  });

  it("is never offered to a signed-in learner, nor when accounts are off", () => {
    expect(offersChoice({ ...guest, signedIn: true })).toBe(false);
    expect(offersChoice({ ...guest, enabled: false })).toBe(false);
  });

  it("is offered once: either choice is remembered on the device", () => {
    for (const choice of ["account", "guest"] as const) {
      reset();
      expect(accountChoice.read()).toBeNull();
      choose(choice);
      expect(accountChoice.read()).toBe(choice);
      expect(offersChoice({ ...guest, chosen: accountChoice.read() !== null })).toBe(false);
    }
  });

  it("reads the device: shown to a new guest, never with a session or once chosen", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.example");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    expect(choiceNeeded("/learn")).toBe(true);
    expect(choiceNeeded("/")).toBe(false);

    accountSummary.set({ name: "Amina", country: null });
    expect(choiceNeeded("/learn")).toBe(false);
    reset();
    storage.set(AUTH_STORAGE_KEY, "{}");
    expect(choiceNeeded("/rafiq")).toBe(false);
    reset();
    choose("guest");
    expect(choiceNeeded("/practice")).toBe(false);

    reset();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(choiceNeeded("/learn")).toBe(false);
  });

  it("lets the Khutuwat tour open only after the choice is answered", () => {
    expect(tourMayOpen(true, true)).toBe(false);
    expect(tourMayOpen(true, false)).toBe(true);
    expect(tourMayOpen(false, false)).toBe(false);
  });
});
