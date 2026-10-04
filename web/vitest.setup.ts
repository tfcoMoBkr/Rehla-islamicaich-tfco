import { vi } from "vitest";

// `server-only` throws outside a React Server environment; the code under test is server code.
vi.mock("server-only", () => ({}));
