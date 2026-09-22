import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/shared/lib/prisma.js", () => ({
  prisma: {
    hold: { updateMany: vi.fn() },
    paymentAttempt: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    stripeEvent: { create: vi.fn() },
    booking: { create: vi.fn() },
    seat: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../../src/shared/lib/stripe.js", () => ({
  stripe: {
    webhooks: { constructEvent: vi.fn() },
    refunds: { create: vi.fn() },
  },
}));

import { app } from "../../src/app.js";
import { Prisma } from "../../src/generated/prisma/client.js";
import { prisma } from "../../src/shared/lib/prisma.js";
import { stripe } from "../../src/shared/lib/stripe.js";

// This suite never runs real Stripe signature verification (`stripe.webhooks.constructEvent`
// itself is mocked) — "valid" vs "invalid" is purely which behavior the mock is configured to
// return/throw for a given test, not real HMAC signing. Real Stripe test-mode signing (via
// `stripe listen`/`stripe trigger`) stays a manual verification step, same philosophy already
// used for the rest of this project's test suite (no real Postgres in CI either, except for the
// holds concurrency suite where a real database was the actual thing under test — see
// decision-log #22).
const SIGNATURE_HEADER = "t=1,v1=fake-signature-value";

function checkoutCompletedEvent(id: string, sessionId: string, paymentIntentId: string) {
  return {
    id,
    type: "checkout.session.completed",
    data: { object: { id: sessionId, payment_intent: paymentIntentId } },
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation((fn) => fn(prisma as never));
  vi.mocked(prisma.stripeEvent.create).mockResolvedValue({} as never);
});

describe("POST /api/payments/webhook", () => {
  it("returns 400 when the stripe-signature header is missing", async () => {
    const res = await request(app).post("/api/payments/webhook").send({});
    expect(res.status).toBe(400);
    expect(stripe.webhooks.constructEvent).not.toHaveBeenCalled();
  });

  it("returns 400 when signature verification fails", async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockImplementation(() => {
      throw new Error("invalid signature");
    });

    const res = await request(app)
      .post("/api/payments/webhook")
      .set("stripe-signature", SIGNATURE_HEADER)
      .send({});

    expect(res.status).toBe(400);
    expect(prisma.stripeEvent.create).not.toHaveBeenCalled();
  });

  it("acknowledges a duplicate event without reprocessing it", async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
      checkoutCompletedEvent("evt_dup", "cs_1", "pi_1"),
    );
    vi.mocked(prisma.stripeEvent.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" }),
    );

    const res = await request(app)
      .post("/api/payments/webhook")
      .set("stripe-signature", SIGNATURE_HEADER)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, duplicate: true });
    expect(prisma.hold.updateMany).not.toHaveBeenCalled();
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it("finalizes exactly one booking on the happy path", async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
      checkoutCompletedEvent("evt_ok", "cs_1", "pi_1"),
    );
    vi.mocked(prisma.paymentAttempt.findUnique).mockResolvedValue({
      id: "attempt-1",
      holdId: "hold-1",
      hold: { userId: "user-1", seats: [{ id: "seat-1", eventId: "evt-1" }] },
    } as never);
    vi.mocked(prisma.hold.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.booking.create).mockResolvedValue({ id: "booking-1" } as never);

    const res = await request(app)
      .post("/api/payments/webhook")
      .set("stripe-signature", SIGNATURE_HEADER)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(prisma.booking.create).toHaveBeenCalledTimes(1);
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("refunds instead of booking when the webhook arrives after the hold expired", async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
      checkoutCompletedEvent("evt_late", "cs_1", "pi_1"),
    );
    vi.mocked(prisma.paymentAttempt.findUnique).mockResolvedValue({
      id: "attempt-1",
      holdId: "hold-1",
      hold: { userId: "user-1", seats: [{ id: "seat-1", eventId: "evt-1" }] },
    } as never);
    vi.mocked(prisma.hold.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(stripe.refunds.create).mockResolvedValue({ id: "re_1" } as never);

    const res = await request(app)
      .post("/api/payments/webhook")
      .set("stripe-signature", SIGNATURE_HEADER)
      .send({});

    expect(res.status).toBe(200);
    expect(prisma.booking.create).not.toHaveBeenCalled();
    expect(stripe.refunds.create).toHaveBeenCalledWith({ payment_intent: "pi_1" });
  });

  it("marks the payment attempt failed on checkout.session.expired", async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
      id: "evt_expired",
      type: "checkout.session.expired",
      data: { object: { id: "cs_1" } },
    } as never);
    vi.mocked(prisma.paymentAttempt.updateMany).mockResolvedValue({ count: 1 });

    const res = await request(app)
      .post("/api/payments/webhook")
      .set("stripe-signature", SIGNATURE_HEADER)
      .send({});

    expect(res.status).toBe(200);
    expect(prisma.paymentAttempt.updateMany).toHaveBeenCalledWith({
      where: { stripeCheckoutSessionId: "cs_1", status: "pending" },
      data: { status: "failed" },
    });
  });

  it("acknowledges an unhandled event type without any writes beyond the idempotency insert", async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
      id: "evt_other",
      type: "payment_intent.created",
      data: { object: {} },
    } as never);

    const res = await request(app)
      .post("/api/payments/webhook")
      .set("stripe-signature", SIGNATURE_HEADER)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(prisma.hold.updateMany).not.toHaveBeenCalled();
    expect(prisma.paymentAttempt.updateMany).not.toHaveBeenCalled();
  });
});
