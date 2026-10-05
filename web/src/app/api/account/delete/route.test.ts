import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deleteUser = vi.fn(async (id: string) => ({ data: { user: { id } }, error: null }));
const getUser = vi.fn(async (token: string) =>
  token === "valid-token" ? { data: { user: { id: "user-1" } }, error: null } : { data: { user: null }, error: { status: 401, code: "bad_jwt" } },
);
const createClient = vi.fn(() => ({ auth: { getUser, admin: { deleteUser } } }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

const { POST } = await import("./route");

const request = (authorization?: string) =>
  new Request("https://rehla.example/api/account/delete", { method: "POST", headers: authorization ? { authorization } : {} });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
});

afterEach(() => vi.unstubAllEnvs());

describe("deleting an account", () => {
  it("checks the learner's own session, then deletes that user with the secret key", async () => {
    const response = await POST(request("Bearer valid-token"));
    expect(response.status).toBe(204);
    expect(createClient).toHaveBeenCalledWith("https://project.supabase.example", "sb_secret_test", expect.anything());
    expect(getUser).toHaveBeenCalledWith("valid-token");
    expect(deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("refuses a request without a session, or with one that does not check out", async () => {
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request("valid-token"))).status).toBe(401);
    expect((await POST(request("Bearer forged"))).status).toBe(401);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("answers 503 and touches nothing when the secret key is not set", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    expect((await POST(request("Bearer valid-token"))).status).toBe(503);
    expect(createClient).not.toHaveBeenCalled();
  });
});
