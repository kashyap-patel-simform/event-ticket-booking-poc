import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/shared/lib/prisma.js", () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    seat: { findMany: vi.fn(), updateMany: vi.fn() },
    hold: { create: vi.fn(), updateManyAndReturn: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import * as holdsService from "../../../../src/modules/holds/holds.service.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../../src/shared/errors/AppError.js";
import { prisma } from "../../../../src/shared/lib/prisma.js";

const FUTURE_DATE = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
const PAST_DATE = new Date(Date.now() - 1000 * 60 * 60 * 24);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation((fn) => fn(prisma as never));
  vi.mocked(prisma.hold.updateManyAndReturn).mockResolvedValue([]);
});

describe("holds.service createHold", () => {
  it("throws NotFoundError without opening a transaction when the event doesn't exist", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

    await expect(
      holdsService.createHold("user-1", "missing", { seatIds: ["seat-1"] }),
    ).rejects.toThrow(NotFoundError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("throws ValidationError when the event's date is in the past", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({ id: "evt-1", date: PAST_DATE } as never);

    await expect(
      holdsService.createHold("user-1", "evt-1", { seatIds: ["seat-1"] }),
    ).rejects.toThrow(ValidationError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when a requested seat doesn't belong to the event", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({ id: "evt-1", date: FUTURE_DATE } as never);
    vi.mocked(prisma.seat.findMany).mockResolvedValue([{ id: "seat-1", label: "1" }] as never);

    await expect(
      holdsService.createHold("user-1", "evt-1", { seatIds: ["seat-1", "seat-2"] }),
    ).rejects.toThrow(NotFoundError);
    expect(prisma.hold.create).not.toHaveBeenCalled();
  });

  it("throws ConflictError naming the unavailable seats when the claim can't take every seat", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({ id: "evt-1", date: FUTURE_DATE } as never);
    vi.mocked(prisma.seat.findMany)
      .mockResolvedValueOnce([
        { id: "seat-1", label: "1" },
        { id: "seat-2", label: "2" },
      ] as never)
      .mockResolvedValueOnce([{ id: "seat-2" }] as never); // the still-unavailable seat
    vi.mocked(prisma.hold.create).mockResolvedValue({
      id: "hold-1",
      status: "active",
      expiresAt: new Date(),
    } as never);
    vi.mocked(prisma.seat.updateMany).mockResolvedValue({ count: 1 }); // only 1 of 2 claimed

    const promise = holdsService.createHold("user-1", "evt-1", {
      seatIds: ["seat-1", "seat-2"],
    });

    await expect(promise).rejects.toThrow(ConflictError);
    await expect(promise).rejects.toMatchObject({ details: { unavailableSeatIds: ["seat-2"] } });
  });

  it("creates the hold and claims every requested seat on the happy path", async () => {
    const requestedSeats = [
      { id: "seat-1", label: "1" },
      { id: "seat-2", label: "2" },
    ];
    vi.mocked(prisma.event.findUnique).mockResolvedValue({ id: "evt-1", date: FUTURE_DATE } as never);
    vi.mocked(prisma.seat.findMany).mockResolvedValueOnce(requestedSeats as never);
    const expiresAt = new Date(Date.now() + holdsService.HOLD_TTL_MS);
    vi.mocked(prisma.hold.create).mockResolvedValue({
      id: "hold-1",
      status: "active",
      expiresAt,
    } as never);
    vi.mocked(prisma.seat.updateMany).mockResolvedValue({ count: 2 });

    const result = await holdsService.createHold("user-1", "evt-1", {
      seatIds: ["seat-1", "seat-2"],
    });

    expect(result).toEqual({
      id: "hold-1",
      status: "active",
      expiresAt,
      seats: requestedSeats,
    });
    expect(prisma.hold.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-1", status: "active" }),
    });
    expect(prisma.seat.updateMany).toHaveBeenCalledWith({
      where: { eventId: "evt-1", id: { in: ["seat-1", "seat-2"] }, status: "available" },
      data: { status: "held", holdId: "hold-1" },
    });
  });
});

describe("holds.service releaseExpiredHoldsForEvent", () => {
  it("is a no-op when no holds have expired", async () => {
    vi.mocked(prisma.hold.updateManyAndReturn).mockResolvedValue([]);

    await holdsService.releaseExpiredHoldsForEvent(prisma as never, "evt-1");

    expect(prisma.seat.updateMany).not.toHaveBeenCalled();
  });

  it("releases every seat belonging to a newly expired hold", async () => {
    vi.mocked(prisma.hold.updateManyAndReturn).mockResolvedValue([
      { id: "hold-1" },
      { id: "hold-2" },
    ] as never);

    await holdsService.releaseExpiredHoldsForEvent(prisma as never, "evt-1");

    expect(prisma.seat.updateMany).toHaveBeenCalledWith({
      where: { holdId: { in: ["hold-1", "hold-2"] } },
      data: { status: "available", holdId: null },
    });
  });
});
