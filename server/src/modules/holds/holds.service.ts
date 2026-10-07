import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/AppError.js";
import { prisma } from "../../shared/lib/prisma.js";
import { publishSeatsUpdated } from "../../shared/lib/sse-hub.js";
import type { CreateHoldInput, HoldResult } from "./holds.types.js";

// Checkout hold window — fixed for this POC, not configurable per environment.
export const HOLD_TTL_MS = 2 * 60 * 1000;

/** Any Prisma client usable both standalone and inside an interactive transaction. */
type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Lazy expiry: releases any `active` holds (and their seats) that have passed their
 * `expiresAt` and touch `eventId`'s seats. There is no background sweep — every path that
 * reads or writes seats/holds for an event must call this first, inside the same transaction,
 * before doing its own work. If nothing on this project ever reads a given event's seats again,
 * an expired hold can sit `held`-but-stale indefinitely; that's an accepted trade-off for a
 * single-instance app with no strict "frees at exactly T+5min" SLA (see decision-log).
 */
export async function releaseExpiredHoldsForEvent(db: Db, eventId: string): Promise<void> {
  const expired = await db.hold.updateManyAndReturn({
    where: {
      status: "active",
      expiresAt: { lte: new Date() },
      seats: { some: { eventId } },
    },
    data: { status: "expired" },
    select: { id: true },
  });

  if (expired.length === 0) return;

  const released = await db.seat.updateManyAndReturn({
    where: { holdId: { in: expired.map((hold) => hold.id) } },
    data: { status: "available", holdId: null },
    select: { id: true, status: true },
  });

  publishSeatsUpdated(eventId, released);
}

// Lets a client recover its own in-progress hold after a page refresh (or a browser-back from
// Stripe) — without this, `activeHold` only ever existed as client-side state set from the
// create-hold response, so a refresh silently lost the "Held — Pay Now" UI even though the hold
// was still perfectly valid server-side, leaving the user stuck looking at their own seats as if
// someone else had taken them.
export async function getActiveHoldForUser(
  userId: string,
  eventId: string,
): Promise<HoldResult | null> {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) {
    throw new NotFoundError("Event not found");
  }

  return prisma.$transaction(async (tx) => {
    // Lazy expiry — see releaseExpiredHoldsForEvent's own comment. Without this, a hold that
    // expired without anyone reading seats since could still look "active" here.
    await releaseExpiredHoldsForEvent(tx, eventId);

    // A user can hold more than one disjoint seat set for the same event (createHold has no
    // one-active-hold-per-user restriction) — most recent wins here, matching the client's own
    // "most recent action" convention elsewhere (e.g. the bookings list).
    const hold = await tx.hold.findFirst({
      where: { userId, status: "active", seats: { some: { eventId } } },
      include: { seats: { select: { id: true, label: true } } },
      orderBy: { createdAt: "desc" },
    });
    if (!hold) return null;

    return {
      id: hold.id,
      status: hold.status,
      expiresAt: hold.expiresAt,
      seats: hold.seats,
    };
  });
}

// Lets a user give up seats they're holding before the TTL runs out, e.g. because they changed
// their mind mid-checkout — previously the only way to release a hold early was to let it expire.
// Uses the schema's existing (until now unused) HoldStatus.released.
export async function releaseHold(userId: string, holdId: string): Promise<void> {
  const hold = await prisma.hold.findUnique({ where: { id: holdId } });
  if (!hold) throw new NotFoundError("Hold not found");
  if (hold.userId !== userId) throw new ForbiddenError("This hold does not belong to you");

  // Same "let the WHERE clause be the source of truth" pattern as the rest of this module: one
  // conditional UPDATE decides whether there was actually anything left to cancel, instead of
  // trusting the `findUnique` above (which could already be stale by the time this runs, e.g. if
  // the hold expired or converted a moment ago).
  const outcome = await prisma.$transaction(async (tx) => {
    const released = await tx.hold.updateMany({
      where: { id: holdId, status: "active" },
      data: { status: "released" },
    });
    if (released.count === 0) return { released: false as const };

    const seats = await tx.seat.updateManyAndReturn({
      where: { holdId },
      data: { status: "available", holdId: null },
      select: { id: true, eventId: true },
    });
    return { released: true as const, seats };
  });

  if (!outcome.released) {
    throw new ConflictError("This hold is no longer active");
  }

  if (outcome.seats.length > 0) {
    publishSeatsUpdated(
      outcome.seats[0]!.eventId,
      outcome.seats.map((seat) => ({ id: seat.id, status: "available" as const })),
    );
  }
}

export async function createHold(
  userId: string,
  eventId: string,
  input: CreateHoldInput,
): Promise<HoldResult> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, date: true },
  });
  if (!event) {
    throw new NotFoundError("Event not found");
  }
  if (event.date.getTime() <= Date.now()) {
    throw new ValidationError("Cannot hold seats for an event whose date is in the past");
  }

  const { hold, seats } = await prisma.$transaction(async (tx) => {
    await releaseExpiredHoldsForEvent(tx, eventId);

    const requestedSeats = await tx.seat.findMany({
      where: { eventId, id: { in: input.seatIds } },
      select: { id: true, label: true },
    });
    if (requestedSeats.length !== input.seatIds.length) {
      throw new NotFoundError("One or more seats do not exist for this event");
    }

    const createdHold = await tx.hold.create({
      data: { userId, status: "active", expiresAt: new Date(Date.now() + HOLD_TTL_MS) },
    });

    // The concurrency-critical step: one bulk conditional UPDATE, not per-seat locking.
    // Postgres locks every matching row as part of this single statement, so a concurrent
    // request targeting an overlapping seat blocks until this transaction commits or rolls
    // back, then re-evaluates `status: "available"` against the now-committed data — it can
    // never also claim a row this transaction won. Because both requests filter the same
    // table by `id IN (...)` rather than acquiring row locks one at a time in application
    // code, two overlapping requests can't deadlock each other here.
    const claim = await tx.seat.updateMany({
      where: { eventId, id: { in: input.seatIds }, status: "available" },
      data: { status: "held", holdId: createdHold.id },
    });

    if (claim.count !== input.seatIds.length) {
      const unavailable = await tx.seat.findMany({
        where: { id: { in: input.seatIds }, NOT: { holdId: createdHold.id } },
        select: { id: true },
      });
      // Throwing inside $transaction rolls back everything from this callback — both the
      // partial claims just made and the Hold row created above. Zero seats end up held.
      throw new ConflictError("One or more requested seats are no longer available", {
        unavailableSeatIds: unavailable.map((seat) => seat.id),
      });
    }

    return { hold: createdHold, seats: requestedSeats };
  });

  publishSeatsUpdated(
    eventId,
    seats.map((seat) => ({ id: seat.id, status: "held" as const })),
  );

  return {
    id: hold.id,
    status: hold.status,
    expiresAt: hold.expiresAt,
    seats: seats.map((seat) => ({ id: seat.id, label: seat.label })),
  };
}
