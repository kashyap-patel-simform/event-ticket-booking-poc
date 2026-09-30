import { randomUUID } from "node:crypto";
import type { Logger } from "winston";
import type Stripe from "stripe";
import { Prisma } from "../../generated/prisma/client.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors/AppError.js";
import { env } from "../../shared/lib/env.js";
import { logger as rootLogger } from "../../shared/lib/logger.js";
import { prisma } from "../../shared/lib/prisma.js";
import { publishSeatsUpdated } from "../../shared/lib/sse-hub.js";
import { stripe } from "../../shared/lib/stripe.js";
import type {
  BookingListItem,
  CheckoutSessionResult,
  CheckoutSessionStatusResult,
} from "./payments.types.js";

const CHECKOUT_SUCCESS_PATH = "/checkout/success";
const CHECKOUT_CANCEL_PATH = "/checkout/cancel";
const CURRENCY = "usd";

// Stripe enforces a 30-minute *minimum* Checkout Session expiry — we cannot make Stripe expire a
// session at our 5-minute hold TTL. Set just above that floor (a small buffer past the stated
// 1800s minimum, in case Stripe's boundary check is strictly-greater-than) rather than defaulting
// to Stripe's 24h ceiling. This bounds, but does not eliminate, how late a webhook can arrive
// after our own hold has already expired — see finalizeOrRefundCheckoutSession below.
const CHECKOUT_SESSION_EXPIRES_SECONDS = 30 * 60 + 60;

export async function createCheckoutSession(
  userId: string,
  holdId: string,
): Promise<CheckoutSessionResult> {
  const hold = await prisma.hold.findUnique({
    where: { id: holdId },
    include: { seats: true },
  });
  if (!hold) throw new NotFoundError("Hold not found");
  if (hold.userId !== userId) throw new ForbiddenError("This hold does not belong to you");
  // Checked directly against expiresAt, not just hold.status — the lazy-expiry mechanism
  // (holds.service.ts) only flips status to "expired" when something reads this event's seats;
  // checking the timestamp here closes that same gap without needing an eventId up front.
  if (hold.status !== "active" || hold.expiresAt.getTime() <= Date.now()) {
    throw new ConflictError("This hold is no longer active");
  }

  const eventId = hold.seats[0]!.eventId;
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
  const amountCents = event.priceCents * hold.seats.length;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${env.CLIENT_ORIGIN}${CHECKOUT_SUCCESS_PATH}?session_id={CHECKOUT_SESSION_ID}`,
    // eventId lets the cancel page link back to the event the user was trying to book; the
    // success page doesn't need it since listMyBookings already returns the event name.
    cancel_url: `${env.CLIENT_ORIGIN}${CHECKOUT_CANCEL_PATH}?eventId=${eventId}`,
    expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_SESSION_EXPIRES_SECONDS,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: amountCents, // server-computed: priceCents × held-seat-count, never client-supplied
          product_data: {
            name: `${event.name} — ${hold.seats.length} seat${hold.seats.length > 1 ? "s" : ""}`,
          },
        },
      },
    ],
    metadata: { holdId: hold.id, userId },
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");

  const paymentAttempt = await prisma.paymentAttempt.create({
    data: {
      holdId: hold.id,
      stripeCheckoutSessionId: session.id,
      amountCents,
      currency: CURRENCY,
      status: "pending",
    },
  });

  rootLogger.info("Checkout session created", {
    holdId: hold.id,
    userId,
    paymentAttemptId: paymentAttempt.id,
    stripeCheckoutSessionId: session.id,
    amountCents,
  });

  return { checkoutUrl: session.url, paymentAttemptId: paymentAttempt.id };
}

/**
 * Idempotency gate: records a Stripe event id before any business logic runs. Returns false
 * (already processed, caller must no-op) when the unique constraint on `id` rejects a duplicate
 * delivery — the same "let a DB constraint be the source of truth" pattern as the seat-hold's
 * conditional UPDATE, just via a unique-insert instead.
 */
export async function recordStripeEvent(stripeEventId: string, type: string): Promise<boolean> {
  try {
    await prisma.stripeEvent.create({ data: { id: stripeEventId, type } });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return false;
    }
    throw err;
  }
}

export async function processStripeEvent(event: Stripe.Event, log: Logger): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await finalizeOrRefundCheckoutSession(
        event.data.object as Stripe.Checkout.Session,
        event.id,
        log,
      );
      return;
    case "checkout.session.expired":
      await markAttemptFailedForSession(
        (event.data.object as Stripe.Checkout.Session).id,
        event.id,
        log,
      );
      return;
    default:
      log.info("Unhandled Stripe webhook event type — acknowledged, no-op", {
        stripeEventId: event.id,
        type: event.type,
      });
  }
}

async function markAttemptFailedForSession(
  sessionId: string,
  stripeEventId: string,
  log: Logger,
): Promise<void> {
  const result = await prisma.paymentAttempt.updateMany({
    where: { stripeCheckoutSessionId: sessionId, status: "pending" },
    data: { status: "failed" },
  });
  log.info("Checkout session expired — payment attempt marked failed", {
    stripeEventId,
    stripeCheckoutSessionId: sessionId,
    attemptsUpdated: result.count,
  });
  // The hold is deliberately left untouched: it will already have expired on its own 5-minute
  // TTL long before Stripe's 30-minute session expiry fires, or expires on its next lazy-expiry
  // read. The user can just start a fresh hold + checkout.
}

async function finalizeOrRefundCheckoutSession(
  session: Stripe.Checkout.Session,
  stripeEventId: string,
  log: Logger,
): Promise<void> {
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  const attempt = await prisma.paymentAttempt.findUnique({
    where: { stripeCheckoutSessionId: session.id },
    include: { hold: true },
  });
  const correlation = {
    stripeEventId,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
  };

  if (!attempt) {
    // No matching PaymentAttempt row — e.g. our DB write after creating the Stripe session
    // crashed, or (should be impossible) a session we never created called back. Stripe has
    // already taken the customer's money and there's nothing to finalize against — refund it.
    log.error("checkout.session.completed with no matching PaymentAttempt — refunding", correlation);
    await refundPaymentIntent(paymentIntentId, undefined, correlation, log);
    return;
  }

  const attemptCorrelation = { ...correlation, paymentAttemptId: attempt.id, holdId: attempt.holdId };

  // Single atomic transaction, single conditional UPDATE deciding finalize-vs-refund — same
  // "let the WHERE clause be the source of truth, don't check-then-act" pattern as
  // holds.service.ts's seat claim. The timestamp is re-checked directly here (not just `status`)
  // so this stays correct even if a concurrent lazy-expiry read is racing this exact hold row:
  // Postgres serializes the two UPDATEs and each re-evaluates its own WHERE against post-commit
  // state. Seats are looked up by holdId *inside* this same transaction (not from a snapshot
  // fetched before it) — a hold whose lazy-expiry release already ran between checkout and this
  // webhook has `Seat.holdId` nulled back out, and looking that up beforehand (as this used to)
  // could find zero seats for a hold this code still thought was worth finalizing, crashing on
  // `seats[0].eventId`. Below, an empty `seats` result is impossible: `claimed.count > 0` proves
  // the hold was still `active` in this same transaction, and the lazy-expiry sweep only ever
  // nulls `Seat.holdId` in the same transaction where it flips that hold to `expired`.
  const outcome = await prisma.$transaction(async (tx) => {
    const claimed = await tx.hold.updateMany({
      where: { id: attempt.holdId, status: "active", expiresAt: { gt: new Date() } },
      data: { status: "converted" },
    });
    if (claimed.count === 0) return { finalized: false as const };

    const seats = await tx.seat.findMany({ where: { holdId: attempt.holdId } });
    const seatIds = seats.map((seat) => seat.id);
    const eventId = seats[0]!.eventId;

    const ticketReference = randomUUID();
    const booking = await tx.booking.create({
      data: {
        userId: attempt.hold.userId,
        eventId,
        paymentAttemptId: attempt.id,
        ticketReference,
        status: "confirmed",
      },
    });
    await tx.seat.updateMany({
      where: { id: { in: seatIds } },
      data: { status: "booked", bookingId: booking.id },
    });
    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: { status: "succeeded", stripePaymentIntentId: paymentIntentId ?? null },
    });
    return { finalized: true as const, booking, ticketReference, eventId, seatIds };
  });

  if (!outcome.finalized) {
    log.warn("Late Stripe webhook for an already-expired hold — refunding", attemptCorrelation);
    await refundPaymentIntent(paymentIntentId, attempt.id, attemptCorrelation, log);
    return;
  }

  publishSeatsUpdated(
    outcome.eventId,
    outcome.seatIds.map((id) => ({ id, status: "booked" as const })),
  );

  log.info("Booking finalized from Stripe checkout", {
    ...attemptCorrelation,
    bookingId: outcome.booking.id,
    ticketReference: outcome.ticketReference,
    seatIds: outcome.seatIds,
  });
}

async function refundPaymentIntent(
  paymentIntentId: string | undefined,
  attemptId: string | undefined,
  correlation: Record<string, unknown>,
  log: Logger,
): Promise<void> {
  if (!paymentIntentId) {
    // A completed "payment"-mode session always carries a payment_intent — should be
    // unreachable. Logged, not thrown: the webhook must still ack 200 (this event is already
    // recorded in StripeEvent, so Stripe won't retry it) — this needs a human, not a retry loop.
    log.error("Cannot refund — completed checkout session has no payment_intent", correlation);
    return;
  }
  try {
    const refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
    if (attemptId) {
      await prisma.paymentAttempt.update({
        where: { id: attemptId },
        data: { status: "refunded", stripePaymentIntentId: paymentIntentId },
      });
    }
    log.warn("Auto-refunded a late/orphaned Stripe payment", {
      ...correlation,
      stripeRefundId: refund.id,
    });
  } catch (err) {
    log.error("Stripe refund attempt itself failed — needs manual follow-up", {
      ...correlation,
      err: err instanceof Error ? err.message : String(err),
    });
    // Not rethrown, for the same reason as above.
  }
}

// Lets the client tell apart "this specific checkout actually produced a booking" from "Stripe
// took the payment but the hold had already expired, so it was refunded" — listMyBookings alone
// can't answer that (it returns whatever the user's most recent *booking* is, which may be an
// older, unrelated one, or nothing at all, when this particular session was refunded instead).
export async function getCheckoutSessionStatus(
  userId: string,
  stripeCheckoutSessionId: string,
): Promise<CheckoutSessionStatusResult> {
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { stripeCheckoutSessionId },
    include: {
      hold: { select: { userId: true } },
      booking: {
        include: {
          event: { select: { id: true, name: true } },
          seats: { select: { id: true, label: true } },
        },
      },
    },
  });
  if (!attempt) throw new NotFoundError("Checkout session not found");
  if (attempt.hold.userId !== userId) {
    throw new ForbiddenError("This checkout session does not belong to you");
  }

  return {
    status: attempt.status,
    booking: attempt.booking
      ? {
          id: attempt.booking.id,
          eventId: attempt.booking.event.id,
          eventName: attempt.booking.event.name,
          ticketReference: attempt.booking.ticketReference,
          status: attempt.booking.status,
          amountCents: attempt.amountCents,
          currency: attempt.currency,
          createdAt: attempt.booking.createdAt,
          seats: attempt.booking.seats,
        }
      : null,
  };
}

export async function listMyBookings(userId: string): Promise<BookingListItem[]> {
  const bookings = await prisma.booking.findMany({
    where: { userId }, // ownership enforced by the query itself, not a post-filter
    include: {
      event: { select: { id: true, name: true } },
      paymentAttempt: { select: { amountCents: true, currency: true } },
      seats: { select: { id: true, label: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return bookings.map((booking) => ({
    id: booking.id,
    eventId: booking.event.id,
    eventName: booking.event.name,
    ticketReference: booking.ticketReference,
    status: booking.status,
    amountCents: booking.paymentAttempt.amountCents,
    currency: booking.paymentAttempt.currency,
    createdAt: booking.createdAt,
    seats: booking.seats,
  }));
}
