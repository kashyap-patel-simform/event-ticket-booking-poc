import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/shared/lib/prisma.js", () => ({
  prisma: {
    booking: { findMany: vi.fn() },
  },
}));

import { app } from "../../src/app.js";
import { env } from "../../src/shared/lib/env.js";
import { prisma } from "../../src/shared/lib/prisma.js";

function authHeaderFor(userId: string) {
  return `Bearer ${jwt.sign({ sub: userId }, env.JWT_SECRET)}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.booking.findMany).mockResolvedValue([]);
});

describe("GET /api/bookings", () => {
  it("returns 401 with no auth header", async () => {
    const res = await request(app).get("/api/bookings");
    expect(res.status).toBe(401);
  });

  it("scopes the query to the authenticated user's own id", async () => {
    const res = await request(app).get("/api/bookings").set("Authorization", authHeaderFor("user-1"));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
  });

  it("scopes to a different caller's id when a different user is authenticated", async () => {
    await request(app).get("/api/bookings").set("Authorization", authHeaderFor("user-2"));

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-2" } }),
    );
  });
});
