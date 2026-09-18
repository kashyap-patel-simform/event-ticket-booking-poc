import { defineConfig } from "vitest/config";

// Fixed, fake secret so tests are deterministic and never depend on the real .env
// (which holds live Neon credentials) — most tests mock Prisma, so DATABASE_URL is unused there.
const JWT_SECRET = "vitest-fixed-test-secret-do-not-use-in-any-real-environment";

// Two projects, not one flat config: the "db" project needs its own globalSetup (spins up a
// real Postgres via testcontainers — see test/integration/db/global-setup.ts) and much longer
// timeouts than everything else. `vitest run` (plain `npm test`) runs both projects — this
// split is purely for configuration isolation, not a way to skip the DB-backed suite by default.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          env: { JWT_SECRET },
          include: ["test/unit/**/*.test.ts", "test/integration/**/*.test.ts"],
          exclude: ["test/integration/db/**"],
        },
      },
      {
        test: {
          name: "db",
          env: { JWT_SECRET },
          include: ["test/integration/db/**/*.test.ts"],
          globalSetup: ["test/integration/db/global-setup.ts"],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
