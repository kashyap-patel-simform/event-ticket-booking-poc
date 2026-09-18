import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/shared/lib/prisma.js", () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    seat: { findMany: vi.fn(), updateMany: vi.fn() },
    hold: { create: vi.fn(), updateManyAndReturn: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { app } from "../../src/app.js";
import { env } from "../../src/shared/lib/env.js";
import { prisma } from "../../src/shared/lib/prisma.js";

const authHeader = `Bearer ${jwt.sign({ sub: "user-1" }, env.JWT_SECRET)}`;
const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation((fn) => fn(prisma as never));
  vi.mocked(prisma.hold.updateManyAndReturn).mockResolvedValue([]);
});

describe("POST /api/events/:id/holds", () => {
  it("returns 401 with no auth header", async () => {
    const res = await request(app).post("/api/events/evt-1/holds").send({ seatIds: ["seat-1"] });
    expect(res.status).toBe(401);
  });

  it("returns 400 for an empty seatIds array", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({ id: "evt-1", date: futureDate } as never);

    const res = await request(app)
      .post("/api/events/evt-1/holds")
      .set("Authorization", authHeader)
      .send({ seatIds: [] });

    expect(res.status).toBe(400);
  });

  it("returns 400 for duplicate seatIds", async () => {
    const res = await request(app)
      .post("/api/events/evt-1/holds")
      .set("Authorization", authHeader)
      .send({ seatIds: ["seat-1", "seat-1"] });

    expect(res.status).toBe(400);
  });

  it("returns 404 when the event doesn't exist", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .post("/api/events/missing/holds")
      .set("Authorization", authHeader)
      .send({ seatIds: ["seat-1"] });

    expect(res.status).toBe(404);
  });

  it("returns 400 when the event's date is in the past", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({
      id: "evt-1",
      date: new Date("2020-01-01T00:00:00.000Z"),
    } as never);

    const res = await request(app)
      .post("/api/events/evt-1/holds")
      .set("Authorization", authHeader)
      .send({ seatIds: ["seat-1"] });

    expect(res.status).toBe(400);
  });

  it("returns 404 when a requested seat doesn't belong to the event", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({ id: "evt-1", date: futureDate } as never);
    vi.mocked(prisma.seat.findMany).mockResolvedValue([]);

    const res = await request(app)
      .post("/api/events/evt-1/holds")
      .set("Authorization", authHeader)
      .send({ seatIds: ["seat-1"] });

    expect(res.status).toBe(404);
  });

  it("returns 409 with the unavailable seat ids when a seat can't be claimed", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({ id: "evt-1", date: futureDate } as never);
    vi.mocked(prisma.seat.findMany)
      .mockResolvedValueOnce([{ id: "seat-1", label: "1" }] as never)
      .mockResolvedValueOnce([{ id: "seat-1" }] as never);
    vi.mocked(prisma.hold.create).mockResolvedValue({
      id: "hold-1",
      status: "active",
      expiresAt: new Date(),
    } as never);
    vi.mocked(prisma.seat.updateMany).mockResolvedValue({ count: 0 });

    const res = await request(app)
      .post("/api/events/evt-1/holds")
      .set("Authorization", authHeader)
      .send({ seatIds: ["seat-1"] });

    expect(res.status).toBe(409);
    expect(res.body.details).toEqual({ unavailableSeatIds: ["seat-1"] });
  });

  it("returns 201 with the created hold on the happy path", async () => {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    vi.mocked(prisma.event.findUnique).mockResolvedValue({ id: "evt-1", date: futureDate } as never);
    vi.mocked(prisma.seat.findMany).mockResolvedValueOnce([
      { id: "seat-1", label: "1" },
    ] as never);
    vi.mocked(prisma.hold.create).mockResolvedValue({
      id: "hold-1",
      status: "active",
      expiresAt,
    } as never);
    vi.mocked(prisma.seat.updateMany).mockResolvedValue({ count: 1 });

    const res = await request(app)
      .post("/api/events/evt-1/holds")
      .set("Authorization", authHeader)
      .send({ seatIds: ["seat-1"] });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: "hold-1",
      status: "active",
      expiresAt: expiresAt.toISOString(),
      seats: [{ id: "seat-1", label: "1" }],
    });
  });
});
