import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// env.ts validates process.env as a side effect of being imported, so each test mutates
// process.env and re-imports the module fresh (vi.resetModules) rather than calling a function.
const ORIGINAL_ENV = process.env;

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("env", () => {
  it("applies defaults when optional vars are absent", async () => {
    delete process.env.PORT;
    delete process.env.CLIENT_ORIGIN;
    process.env.NODE_ENV = "development";

    const { env } = await import("../../../../src/shared/lib/env.js");

    expect(env.PORT).toBe(3000);
    expect(env.CLIENT_ORIGIN).toBe("http://localhost:5173");
    expect(env.NODE_ENV).toBe("development");
  });

  it("coerces PORT to a number", async () => {
    process.env.PORT = "4321";

    const { env } = await import("../../../../src/shared/lib/env.js");

    expect(env.PORT).toBe(4321);
  });

  it("throws when PORT is not a positive integer", async () => {
    process.env.PORT = "not-a-number";

    await expect(import("../../../../src/shared/lib/env.js")).rejects.toThrow();
  });

  it("throws when NODE_ENV is not one of the allowed values", async () => {
    process.env.NODE_ENV = "staging";

    await expect(import("../../../../src/shared/lib/env.js")).rejects.toThrow();
  });
});
