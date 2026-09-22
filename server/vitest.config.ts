import { defineConfig } from "vitest/config";

// Fixed, fake secrets so tests are deterministic and never depend on the real .env
// (which holds live Neon/Stripe credentials) — most tests mock Prisma/Stripe entirely, these
// values just need to satisfy env.ts's zod schema so the app module graph can even be imported.
const JWT_SECRET = "vitest-fixed-test-secret-do-not-use-in-any-real-environment";
const STRIPE_SECRET_KEY = "sk_test_vitest_fixed_do_not_use";
const STRIPE_WEBHOOK_SECRET = "whsec_vitest_fixed_do_not_use";

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
          env: { JWT_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET },
          include: ["test/unit/**/*.test.ts", "test/integration/**/*.test.ts"],
          exclude: ["test/integration/db/**"],
        },
      },
      {
        test: {
          name: "db",
          env: { JWT_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET },
          include: ["test/integration/db/**/*.test.ts"],
          globalSetup: ["test/integration/db/global-setup.ts"],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
