import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors/AppError.js";
import { prisma } from "../../shared/lib/prisma.js";
import type { CreateHoldInput, HoldResult } from "./holds.types.js";

// Checkout hold window — fixed for this POC, not configurable per environment.
export const HOLD_TTL_MS = 5 * 60 * 1000;

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

  await db.seat.updateMany({
    where: { holdId: { in: expired.map((hold) => hold.id) } },
    data: { status: "available", holdId: null },
  });
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

  return {
    id: hold.id,
    status: hold.status,
    expiresAt: hold.expiresAt,
    seats: seats.map((seat) => ({ id: seat.id, label: seat.label })),
  };
}
