import { defineConfig } from "vitest/config";

// Fixed, fake secret so tests are deterministic and never depend on the real .env
// (which holds live Neon credentials) — auth tests mock Prisma, so DATABASE_URL is unused here.
export default defineConfig({
  test: {
    env: {
      JWT_SECRET: "vitest-fixed-test-secret-do-not-use-in-any-real-environment",
    },
  },
});
