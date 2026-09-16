import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/shared/lib/prisma.js", () => ({
  prisma: {
    event: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    seat: { createMany: vi.fn(), findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import * as eventsService from "../../../../src/modules/events/events.service.js";
import { NotFoundError } from "../../../../src/shared/errors/AppError.js";
import { prisma } from "../../../../src/shared/lib/prisma.js";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation((fn) => fn(prisma as never));
});

describe("events.service createEvent", () => {
  it("creates an event and provisions the requested number of seats", async () => {
    const now = new Date();
    vi.mocked(prisma.event.create).mockResolvedValue({
      id: "evt-1",
      organiserId: "user-1",
      name: "Test Concert",
      date: now,
      venue: "Main Hall",
      priceCents: 2500,
      createdAt: now,
    });
    vi.mocked(prisma.seat.createMany).mockResolvedValue({ count: 10 });

    const result = await eventsService.createEvent("user-1", {
      name: "Test Concert",
      date: now,
      venue: "Main Hall",
      priceCents: 2500,
      seatCount: 10,
    });

    expect(result.seatCounts).toEqual({ available: 10, held: 0, booked: 0 });

    const createManyCall = vi.mocked(prisma.seat.createMany).mock.calls[0]?.[0];
    const seatsData = createManyCall?.data as { eventId: string; label: string }[];
    expect(seatsData).toHaveLength(10);
    expect(seatsData.map((s) => s.label)).toEqual(
      Array.from({ length: 10 }, (_, i) => String(i + 1)),
    );
    expect(seatsData.every((s) => s.eventId === "evt-1")).toBe(true);
  });
});

describe("events.service getEventById", () => {
  it("folds groupBy rows into seat counts", async () => {
    const now = new Date();
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      id: "evt-1",
      organiserId: "user-1",
      name: "Test Concert",
      date: now,
      venue: "Main Hall",
      priceCents: 2500,
      createdAt: now,
    });
    vi.mocked(prisma.seat.groupBy).mockResolvedValue([
      { status: "available", _count: 5 },
      { status: "held", _count: 2 },
      { status: "booked", _count: 1 },
    ] as never);

    const result = await eventsService.getEventById("evt-1");

    expect(result.seatCounts).toEqual({ available: 5, held: 2, booked: 1 });
    expect(prisma.seat.groupBy).toHaveBeenCalledWith({
      by: ["status"],
      where: { eventId: "evt-1" },
      _count: true,
    });
  });

  it("throws NotFoundError without querying seats when the event doesn't exist", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

    await expect(eventsService.getEventById("missing")).rejects.toThrow(NotFoundError);
    expect(prisma.seat.groupBy).not.toHaveBeenCalled();
  });
});

describe("events.service listEvents", () => {
  it("computes skip/take from page and limit", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([]);
    vi.mocked(prisma.event.count).mockResolvedValue(0);

    const result = await eventsService.listEvents({ page: 1, limit: 20 });

    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
    expect(result).toEqual({ data: [], page: 1, limit: 20, total: 0 });
  });

  it("applies pagination overrides", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([]);
    vi.mocked(prisma.event.count).mockResolvedValue(0);

    await eventsService.listEvents({ page: 3, limit: 10 });

    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });
});

describe("events.service listSeats", () => {
  it("returns the full seat list filtered by status, unpaginated", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({ id: "evt-1" } as never);
    vi.mocked(prisma.seat.findMany).mockResolvedValue([]);

    const result = await eventsService.listSeats("evt-1", { status: "available" });

    expect(prisma.seat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: "evt-1", status: "available" } }),
    );
    const call = vi.mocked(prisma.seat.findMany).mock.calls[0]?.[0];
    expect(call).not.toHaveProperty("skip");
    expect(call).not.toHaveProperty("take");
    expect(prisma.seat.count).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("throws NotFoundError without querying seats when the event doesn't exist", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

    await expect(eventsService.listSeats("missing", {})).rejects.toThrow(NotFoundError);
    expect(prisma.seat.findMany).not.toHaveBeenCalled();
  });
});
