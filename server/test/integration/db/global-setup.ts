import { execSync } from "node:child_process";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";

let container: StartedPostgreSqlContainer;

// Runs once before this Vitest project's test files are loaded. Boots a throwaway Postgres in
// a container, points DATABASE_URL/DIRECT_URL at it, and applies every existing migration —
// so the tests in this folder exercise real DB-level row locking, not a mocked Prisma client.
// `dotenv` (loaded by prisma.config.ts) never overwrites an already-set env var, so this never
// touches the real Neon dev/prod database.
export async function setup() {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  const url = container.getConnectionUri();

  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}

export async function teardown() {
  await container.stop();
}
