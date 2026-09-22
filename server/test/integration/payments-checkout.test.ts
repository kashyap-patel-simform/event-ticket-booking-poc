import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/shared/lib/prisma.js", () => ({
  prisma: {
    hold: { findUnique: vi.fn() },
    event: { findUniqueOrThrow: vi.fn() },
    paymentAttempt: { create: vi.fn() },
  },
}));

vi.mock("../../src/shared/lib/stripe.js", () => ({
  stripe: {
    checkout: { sessions: { create: vi.fn() } },
  },
}));

import { app } from "../../src/app.js";
import { env } from "../../src/shared/lib/env.js";
import { prisma } from "../../src/shared/lib/prisma.js";
import { stripe } from "../../src/shared/lib/stripe.js";

const authHeader = `Bearer ${jwt.sign({ sub: "user-1" }, env.JWT_SECRET)}`;
const futureExpiry = new Date(Date.now() + 5 * 60 * 1000);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/holds/:holdId/checkout", () => {
  it("returns 401 with no auth header", async () => {
    const res = await request(app).post("/api/holds/hold-1/checkout");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the hold doesn't exist", async () => {
    vi.mocked(prisma.hold.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post("/api/holds/missing/checkout")
      .set("Authorization", authHeader);

    expect(res.status).toBe(404);
  });

  it("returns 403 when the hold belongs to another user", async () => {
    vi.mocked(prisma.hold.findUnique).mockResolvedValue({
      id: "hold-1",
      userId: "someone-else",
      status: "active",
      expiresAt: futureExpiry,
      seats: [{ id: "seat-1", eventId: "evt-1" }],
    } as never);

    const res = await request(app)
      .post("/api/holds/hold-1/checkout")
      .set("Authorization", authHeader);

    expect(res.status).toBe(403);
  });

  it("returns 409 when the hold is no longer active", async () => {
    vi.mocked(prisma.hold.findUnique).mockResolvedValue({
      id: "hold-1",
      userId: "user-1",
      status: "expired",
      expiresAt: futureExpiry,
      seats: [{ id: "seat-1", eventId: "evt-1" }],
    } as never);

    const res = await request(app)
      .post("/api/holds/hold-1/checkout")
      .set("Authorization", authHeader);

    expect(res.status).toBe(409);
  });

  it("returns 201 with a checkout url, computing the amount server-side (no request body needed)", async () => {
    vi.mocked(prisma.hold.findUnique).mockResolvedValue({
      id: "hold-1",
      userId: "user-1",
      status: "active",
      expiresAt: futureExpiry,
      seats: [
        { id: "seat-1", eventId: "evt-1" },
        { id: "seat-2", eventId: "evt-1" },
      ],
    } as never);
    vi.mocked(prisma.event.findUniqueOrThrow).mockResolvedValue({
      id: "evt-1",
      name: "Test Concert",
      priceCents: 1000,
    } as never);
    vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
      id: "cs_test_1",
      url: "https://checkout.stripe.com/pay/cs_test_1",
    } as never);
    vi.mocked(prisma.paymentAttempt.create).mockResolvedValue({ id: "attempt-1" } as never);

    const res = await request(app)
      .post("/api/holds/hold-1/checkout")
      .set("Authorization", authHeader)
      .send();

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      checkoutUrl: "https://checkout.stripe.com/pay/cs_test_1",
      paymentAttemptId: "attempt-1",
    });
    const sessionCall = vi.mocked(stripe.checkout.sessions.create).mock.calls[0]?.[0];
    expect(sessionCall?.line_items?.[0]?.price_data?.unit_amount).toBe(2000); // 1000 * 2 seats
  });
});
