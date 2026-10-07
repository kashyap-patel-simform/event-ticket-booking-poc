import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/shared/lib/prisma.js", () => ({
  prisma: {
    booking: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    seat: { updateManyAndReturn: vi.fn() },
    paymentAttempt: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../../src/shared/lib/stripe.js", () => ({
  stripe: { refunds: { create: vi.fn() } },
}));

vi.mock("../../src/shared/lib/sse-hub.js", () => ({
  publishSeatsUpdated: vi.fn(),
}));

import { app } from "../../src/app.js";
import { env } from "../../src/shared/lib/env.js";
import { prisma } from "../../src/shared/lib/prisma.js";
import { stripe } from "../../src/shared/lib/stripe.js";

function authHeaderFor(userId: string) {
  return `Bearer ${jwt.sign({ sub: userId }, env.JWT_SECRET)}`;
}

const FAR_FUTURE_EVENT_DATE = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.booking.findMany).mockResolvedValue([]);
  vi.mocked(prisma.$transaction).mockImplementation((fn) => fn(prisma as never));
});

describe("GET /api/bookings", () => {
  it("returns 401 with no auth header", async () => {
    const res = await request(app).get("/api/bookings");
    expect(res.status).toBe(401);
  });

  it("scopes the query to the authenticated user's own id", async () => {
    const res = await request(app)
      .get("/api/bookings")
      .set("Authorization", authHeaderFor("user-1"));

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

describe("POST /api/bookings/:bookingId/cancel", () => {
  function mockConfirmedBooking(overrides: Record<string, unknown> = {}) {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      id: "booking-1",
      userId: "user-1",
      status: "confirmed",
      paymentAttemptId: "attempt-1",
      event: { id: "evt-1", date: FAR_FUTURE_EVENT_DATE },
      paymentAttempt: { id: "attempt-1", stripePaymentIntentId: "pi_1" },
      ...overrides,
    } as never);
  }

  it("returns 401 with no auth header", async () => {
    const res = await request(app).post("/api/bookings/booking-1/cancel");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the booking doesn't exist", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post("/api/bookings/booking-1/cancel")
      .set("Authorization", authHeaderFor("user-1"));

    expect(res.status).toBe(404);
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("returns 403 when the booking belongs to another user", async () => {
    mockConfirmedBooking({ userId: "someone-else" });

    const res = await request(app)
      .post("/api/bookings/booking-1/cancel")
      .set("Authorization", authHeaderFor("user-1"));

    expect(res.status).toBe(403);
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("returns 409 when the booking is no longer confirmed", async () => {
    mockConfirmedBooking({ status: "cancelled" });

    const res = await request(app)
      .post("/api/bookings/booking-1/cancel")
      .set("Authorization", authHeaderFor("user-1"));

    expect(res.status).toBe(409);
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("returns 409 when the event is within the 24h cancellation window", async () => {
    mockConfirmedBooking({
      event: { id: "evt-1", date: new Date(Date.now() + 1000 * 60 * 60 * 23) },
    });

    const res = await request(app)
      .post("/api/bookings/booking-1/cancel")
      .set("Authorization", authHeaderFor("user-1"));

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/24 hours/i);
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("refunds via Stripe and returns 204 on the happy path", async () => {
    mockConfirmedBooking();
    vi.mocked(stripe.refunds.create).mockResolvedValue({
      id: "re_1",
      status: "succeeded",
    } as never);
    vi.mocked(prisma.booking.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.seat.updateManyAndReturn).mockResolvedValue([
      { id: "seat-1", eventId: "evt-1" },
    ] as never);

    const res = await request(app)
      .post("/api/bookings/booking-1/cancel")
      .set("Authorization", authHeaderFor("user-1"));

    expect(res.status).toBe(204);
    expect(stripe.refunds.create).toHaveBeenCalledWith({ payment_intent: "pi_1" });
    expect(prisma.paymentAttempt.update).toHaveBeenCalledWith({
      where: { id: "attempt-1" },
      data: { status: "refunded" },
    });
  });
});
