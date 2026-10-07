import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/shared/lib/prisma.js", () => ({
  prisma: {
    hold: { findUnique: vi.fn(), updateMany: vi.fn() },
    event: { findUniqueOrThrow: vi.fn() },
    paymentAttempt: { create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    stripeEvent: { create: vi.fn() },
    booking: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    seat: { updateMany: vi.fn(), findMany: vi.fn(), updateManyAndReturn: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../../../../src/shared/lib/stripe.js", () => ({
  stripe: {
    checkout: { sessions: { create: vi.fn() } },
    refunds: { create: vi.fn() },
  },
}));

vi.mock("../../../../src/shared/lib/sse-hub.js", () => ({
  publishSeatsUpdated: vi.fn(),
}));

import { Prisma } from "../../../../src/generated/prisma/client.js";
import * as paymentsService from "../../../../src/modules/payments/payments.service.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../../../src/shared/errors/AppError.js";
import { prisma } from "../../../../src/shared/lib/prisma.js";
import { publishSeatsUpdated } from "../../../../src/shared/lib/sse-hub.js";
import { stripe } from "../../../../src/shared/lib/stripe.js";

const noopLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never;

const FUTURE_EXPIRY = new Date(Date.now() + 5 * 60 * 1000);
const PAST_EXPIRY = new Date(Date.now() - 1000);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation((fn) => fn(prisma as never));
});

describe("payments.service createCheckoutSession", () => {
  it("throws NotFoundError when the hold doesn't exist", async () => {
    vi.mocked(prisma.hold.findUnique).mockResolvedValue(null);

    await expect(paymentsService.createCheckoutSession("user-1", "hold-1")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("throws ForbiddenError when the hold belongs to another user", async () => {
    vi.mocked(prisma.hold.findUnique).mockResolvedValue({
      id: "hold-1",
      userId: "someone-else",
      status: "active",
      expiresAt: FUTURE_EXPIRY,
      seats: [{ id: "seat-1", eventId: "evt-1" }],
    } as never);

    await expect(paymentsService.createCheckoutSession("user-1", "hold-1")).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("throws ConflictError when the hold's status isn't active", async () => {
    vi.mocked(prisma.hold.findUnique).mockResolvedValue({
      id: "hold-1",
      userId: "user-1",
      status: "expired",
      expiresAt: FUTURE_EXPIRY,
      seats: [{ id: "seat-1", eventId: "evt-1" }],
    } as never);

    await expect(paymentsService.createCheckoutSession("user-1", "hold-1")).rejects.toThrow(
      ConflictError,
    );
  });

  it("throws ConflictError when the hold's expiresAt has already passed", async () => {
    vi.mocked(prisma.hold.findUnique).mockResolvedValue({
      id: "hold-1",
      userId: "user-1",
      status: "active",
      expiresAt: PAST_EXPIRY,
      seats: [{ id: "seat-1", eventId: "evt-1" }],
    } as never);

    await expect(paymentsService.createCheckoutSession("user-1", "hold-1")).rejects.toThrow(
      ConflictError,
    );
  });

  it("computes the amount server-side and creates the checkout session + payment attempt", async () => {
    vi.mocked(prisma.hold.findUnique).mockResolvedValue({
      id: "hold-1",
      userId: "user-1",
      status: "active",
      expiresAt: FUTURE_EXPIRY,
      seats: [
        { id: "seat-1", eventId: "evt-1" },
        { id: "seat-2", eventId: "evt-1" },
      ],
    } as never);
    vi.mocked(prisma.event.findUniqueOrThrow).mockResolvedValue({
      id: "evt-1",
      name: "Test Concert",
      priceCents: 2500,
    } as never);
    vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/pay/cs_test_123",
    } as never);
    vi.mocked(prisma.paymentAttempt.create).mockResolvedValue({
      id: "attempt-1",
    } as never);

    const result = await paymentsService.createCheckoutSession("user-1", "hold-1");

    expect(result).toEqual({
      checkoutUrl: "https://checkout.stripe.com/pay/cs_test_123",
      paymentAttemptId: "attempt-1",
    });
    const sessionCall = vi.mocked(stripe.checkout.sessions.create).mock.calls[0]?.[0];
    expect(sessionCall?.line_items?.[0]).toMatchObject({
      price_data: expect.objectContaining({ unit_amount: 5000 }), // 2500 * 2 seats
    });
    expect(sessionCall?.cancel_url).toBe("http://localhost:5173/checkout/cancel?eventId=evt-1");
    expect(prisma.paymentAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        holdId: "hold-1",
        stripeCheckoutSessionId: "cs_test_123",
        amountCents: 5000,
        status: "pending",
      }),
    });
  });
});

describe("payments.service recordStripeEvent", () => {
  it("returns true on a fresh insert", async () => {
    vi.mocked(prisma.stripeEvent.create).mockResolvedValue({} as never);

    await expect(
      paymentsService.recordStripeEvent("evt_1", "checkout.session.completed"),
    ).resolves.toBe(true);
  });

  it("returns false without rethrowing on a duplicate (P2002)", async () => {
    vi.mocked(prisma.stripeEvent.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    await expect(
      paymentsService.recordStripeEvent("evt_1", "checkout.session.completed"),
    ).resolves.toBe(false);
  });

  it("rethrows any other error", async () => {
    vi.mocked(prisma.stripeEvent.create).mockRejectedValue(new Error("db down"));

    await expect(
      paymentsService.recordStripeEvent("evt_1", "checkout.session.completed"),
    ).rejects.toThrow("db down");
  });
});

describe("payments.service processStripeEvent", () => {
  function checkoutCompletedEvent(sessionId: string, paymentIntentId: string) {
    return {
      id: "evt_completed_1",
      type: "checkout.session.completed",
      data: { object: { id: sessionId, payment_intent: paymentIntentId } },
    } as never;
  }

  it("finalizes exactly one booking on the happy path", async () => {
    vi.mocked(prisma.paymentAttempt.findUnique).mockResolvedValue({
      id: "attempt-1",
      holdId: "hold-1",
      hold: { userId: "user-1" },
    } as never);
    vi.mocked(prisma.hold.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.seat.findMany).mockResolvedValue([
      { id: "seat-1", eventId: "evt-1", label: "1" },
      { id: "seat-2", eventId: "evt-1", label: "2" },
    ] as never);
    vi.mocked(prisma.booking.create).mockResolvedValue({ id: "booking-1" } as never);

    await paymentsService.processStripeEvent(checkoutCompletedEvent("cs_1", "pi_1"), noopLog);

    expect(prisma.seat.findMany).toHaveBeenCalledWith({ where: { holdId: "hold-1" } });
    expect(prisma.booking.create).toHaveBeenCalledTimes(1);
    expect(prisma.booking.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        eventId: "evt-1",
        status: "confirmed",
        seatLabels: ["1", "2"],
      }),
    });
    expect(prisma.seat.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["seat-1", "seat-2"] } },
      data: { status: "booked", bookingId: "booking-1" },
    });
    expect(prisma.paymentAttempt.update).toHaveBeenCalledWith({
      where: { id: "attempt-1" },
      data: { status: "succeeded", stripePaymentIntentId: "pi_1" },
    });
    expect(stripe.refunds.create).not.toHaveBeenCalled();
    expect(publishSeatsUpdated).toHaveBeenCalledWith("evt-1", [
      { id: "seat-1", status: "booked" },
      { id: "seat-2", status: "booked" },
    ]);
  });

  it("refunds instead of booking when the hold already expired", async () => {
    vi.mocked(prisma.paymentAttempt.findUnique).mockResolvedValue({
      id: "attempt-1",
      holdId: "hold-1",
      hold: { userId: "user-1" },
    } as never);
    vi.mocked(prisma.hold.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(stripe.refunds.create).mockResolvedValue({ id: "re_1" } as never);

    await paymentsService.processStripeEvent(checkoutCompletedEvent("cs_1", "pi_1"), noopLog);

    expect(prisma.booking.create).not.toHaveBeenCalled();
    expect(stripe.refunds.create).toHaveBeenCalledWith({ payment_intent: "pi_1" });
    expect(prisma.paymentAttempt.update).toHaveBeenCalledWith({
      where: { id: "attempt-1" },
      data: { status: "refunded", stripePaymentIntentId: "pi_1" },
    });
    expect(publishSeatsUpdated).not.toHaveBeenCalled();
  });

  it("refunds an orphaned session with no matching payment attempt", async () => {
    vi.mocked(prisma.paymentAttempt.findUnique).mockResolvedValue(null);
    vi.mocked(stripe.refunds.create).mockResolvedValue({ id: "re_1" } as never);

    await paymentsService.processStripeEvent(
      checkoutCompletedEvent("cs_orphan", "pi_orphan"),
      noopLog,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(stripe.refunds.create).toHaveBeenCalledWith({ payment_intent: "pi_orphan" });
    expect(prisma.paymentAttempt.update).not.toHaveBeenCalled();
  });

  it("marks the payment attempt failed on checkout.session.expired, without touching the hold", async () => {
    vi.mocked(prisma.paymentAttempt.updateMany).mockResolvedValue({ count: 1 });

    await paymentsService.processStripeEvent(
      {
        id: "evt_expired_1",
        type: "checkout.session.expired",
        data: { object: { id: "cs_1" } },
      } as never,
      noopLog,
    );

    expect(prisma.paymentAttempt.updateMany).toHaveBeenCalledWith({
      where: { stripeCheckoutSessionId: "cs_1", status: "pending" },
      data: { status: "failed" },
    });
    expect(prisma.hold.updateMany).not.toHaveBeenCalled();
  });

  it("no-ops cleanly on an unhandled event type", async () => {
    await paymentsService.processStripeEvent(
      { id: "evt_other", type: "payment_intent.created", data: { object: {} } } as never,
      noopLog,
    );

    expect(prisma.paymentAttempt.findUnique).not.toHaveBeenCalled();
    expect(prisma.paymentAttempt.updateMany).not.toHaveBeenCalled();
  });
});

describe("payments.service listMyBookings", () => {
  it("scopes the query to the given user and maps fields", async () => {
    const createdAt = new Date();
    const eventDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10);
    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        id: "booking-1",
        ticketReference: "ticket-abc",
        status: "confirmed",
        createdAt,
        event: { id: "evt-1", name: "Test Concert", date: eventDate },
        paymentAttempt: { amountCents: 5000, currency: "usd" },
        seatLabels: ["1"],
      },
    ] as never);

    const result = await paymentsService.listMyBookings("user-1");

    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
    expect(result).toEqual([
      {
        id: "booking-1",
        eventId: "evt-1",
        eventName: "Test Concert",
        eventDate,
        ticketReference: "ticket-abc",
        status: "confirmed",
        amountCents: 5000,
        currency: "usd",
        createdAt,
        seatLabels: ["1"],
      },
    ]);
  });
});

describe("payments.service cancelBooking", () => {
  const FAR_FUTURE_EVENT_DATE = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10);
  const WITHIN_CUTOFF_EVENT_DATE = new Date(Date.now() + 1000 * 60 * 60 * 23);

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

  it("throws NotFoundError when the booking doesn't exist", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue(null);

    await expect(paymentsService.cancelBooking("user-1", "booking-1")).rejects.toThrow(
      NotFoundError,
    );
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("throws ForbiddenError when the booking belongs to another user", async () => {
    mockConfirmedBooking({ userId: "someone-else" });

    await expect(paymentsService.cancelBooking("user-1", "booking-1")).rejects.toThrow(
      ForbiddenError,
    );
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("throws ConflictError when the booking isn't confirmed", async () => {
    mockConfirmedBooking({ status: "cancelled" });

    await expect(paymentsService.cancelBooking("user-1", "booking-1")).rejects.toThrow(
      ConflictError,
    );
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("throws ConflictError when the event is within the 24h cancellation window", async () => {
    mockConfirmedBooking({ event: { id: "evt-1", date: WITHIN_CUTOFF_EVENT_DATE } });

    await expect(paymentsService.cancelBooking("user-1", "booking-1")).rejects.toThrow(
      ConflictError,
    );
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("propagates a Stripe refund failure and makes no DB writes", async () => {
    mockConfirmedBooking();
    vi.mocked(stripe.refunds.create).mockRejectedValue(new Error("stripe is down"));

    await expect(paymentsService.cancelBooking("user-1", "booking-1")).rejects.toThrow(
      "stripe is down",
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("throws and makes no DB writes when the refund doesn't succeed", async () => {
    mockConfirmedBooking();
    vi.mocked(stripe.refunds.create).mockResolvedValue({ id: "re_1", status: "pending" } as never);

    await expect(paymentsService.cancelBooking("user-1", "booking-1")).rejects.toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refunds via Stripe, cancels the booking, frees the seats, and publishes the update", async () => {
    mockConfirmedBooking();
    vi.mocked(stripe.refunds.create).mockResolvedValue({
      id: "re_1",
      status: "succeeded",
    } as never);
    vi.mocked(prisma.booking.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.seat.updateManyAndReturn).mockResolvedValue([
      { id: "seat-1", eventId: "evt-1" },
      { id: "seat-2", eventId: "evt-1" },
    ] as never);

    await paymentsService.cancelBooking("user-1", "booking-1");

    expect(stripe.refunds.create).toHaveBeenCalledWith({ payment_intent: "pi_1" });
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: "booking-1", status: "confirmed" },
      data: { status: "cancelled" },
    });
    expect(prisma.seat.updateManyAndReturn).toHaveBeenCalledWith({
      where: { bookingId: "booking-1" },
      data: { status: "available", bookingId: null, holdId: null },
      select: { id: true, eventId: true },
    });
    expect(prisma.paymentAttempt.update).toHaveBeenCalledWith({
      where: { id: "attempt-1" },
      data: { status: "refunded" },
    });
    expect(publishSeatsUpdated).toHaveBeenCalledWith("evt-1", [
      { id: "seat-1", status: "available" },
      { id: "seat-2", status: "available" },
    ]);
  });

  it("throws ConflictError if the booking was no longer confirmed by the time the transaction ran", async () => {
    mockConfirmedBooking();
    vi.mocked(stripe.refunds.create).mockResolvedValue({
      id: "re_1",
      status: "succeeded",
    } as never);
    vi.mocked(prisma.booking.updateMany).mockResolvedValue({ count: 0 });

    await expect(paymentsService.cancelBooking("user-1", "booking-1")).rejects.toThrow(
      ConflictError,
    );
  });
});
