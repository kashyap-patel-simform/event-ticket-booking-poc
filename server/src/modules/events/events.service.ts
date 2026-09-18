import { NotFoundError } from "../../shared/errors/AppError.js";
import { prisma } from "../../shared/lib/prisma.js";
import * as holdsService from "../holds/holds.service.js";
import type {
  CreateEventInput,
  EventDetail,
  EventListItem,
  ListEventsQuery,
  ListSeatsQuery,
  PaginatedResult,
  SeatListItem,
} from "./events.types.js";

export async function createEvent(organiserId: string, input: CreateEventInput): Promise<EventDetail> {
  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        organiserId,
        name: input.name,
        date: input.date,
        venue: input.venue,
        priceCents: input.priceCents,
      },
    });

    const seatsData = Array.from({ length: input.seatCount }, (_, i) => ({
      eventId: created.id,
      label: String(i + 1),
    }));
    await tx.seat.createMany({ data: seatsData });

    return created;
  });

  return {
    id: event.id,
    organiserId: event.organiserId,
    name: event.name,
    date: event.date,
    venue: event.venue,
    priceCents: event.priceCents,
    createdAt: event.createdAt,
    // Just created exactly `seatCount` seats, all `available` — no extra query needed.
    seatCounts: { available: input.seatCount, held: 0, booked: 0 },
  };
}

export async function listEvents(query: ListEventsQuery): Promise<PaginatedResult<EventListItem>> {
  const [events, total] = await Promise.all([
    prisma.event.findMany({
      select: {
        id: true,
        name: true,
        date: true,
        venue: true,
        priceCents: true,
        organiserId: true,
        createdAt: true,
        _count: { select: { seats: true } },
      },
      orderBy: { date: "asc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.event.count(),
  ]);

  const data: EventListItem[] = events.map((e) => ({
    id: e.id,
    name: e.name,
    date: e.date,
    venue: e.venue,
    priceCents: e.priceCents,
    organiserId: e.organiserId,
    createdAt: e.createdAt,
    seatCount: e._count.seats,
  }));

  return { data, page: query.page, limit: query.limit, total };
}

export async function getEventById(eventId: string): Promise<EventDetail> {
  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundError("Event not found");
    }

    // Lazy expiry: release any holds on this event's seats that have passed their TTL before
    // reading current counts, so a stale `held` seat never shows as unavailable.
    await holdsService.releaseExpiredHoldsForEvent(tx, eventId);

    const grouped = await tx.seat.groupBy({
      by: ["status"],
      where: { eventId },
      _count: true,
    });

    const seatCounts = { available: 0, held: 0, booked: 0 };
    for (const row of grouped) {
      seatCounts[row.status as keyof typeof seatCounts] = row._count;
    }

    return {
      id: event.id,
      organiserId: event.organiserId,
      name: event.name,
      date: event.date,
      venue: event.venue,
      priceCents: event.priceCents,
      createdAt: event.createdAt,
      seatCounts,
    };
  });
}

export async function listSeats(eventId: string, query: ListSeatsQuery): Promise<SeatListItem[]> {
  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });
    if (!event) {
      throw new NotFoundError("Event not found");
    }

    // Lazy expiry — see comment in getEventById.
    await holdsService.releaseExpiredHoldsForEvent(tx, eventId);

    const where = { eventId, ...(query.status ? { status: query.status } : {}) };

    // Not paginated — seat count is capped at 500/event (createEventSchema), and the
    // frontend seat-picker layout needs the full set in one response to render a grid.
    return tx.seat.findMany({
      where,
      select: { id: true, label: true, status: true },
      // `label` is "1".."500" and sorts lexicographically, not numerically — order by
      // `id` (cuid, roughly insertion-ordered) instead.
      orderBy: { id: "asc" },
    });
  });
}
