import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/shared/lib/prisma.js", () => ({
  prisma: {
    event: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    seat: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      updateMany: vi.fn(),
    },
    hold: { updateManyAndReturn: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { app } from "../../src/app.js";
import { env } from "../../src/shared/lib/env.js";
import { prisma } from "../../src/shared/lib/prisma.js";

const authHeader = `Bearer ${jwt.sign({ sub: "user-1" }, env.JWT_SECRET)}`;
const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation((fn) => fn(prisma as never));
  vi.mocked(prisma.hold.updateManyAndReturn).mockResolvedValue([]);
});

describe("POST /api/events", () => {
  it("returns 401 with no auth header", async () => {
    const res = await request(app).post("/api/events").send({});
    expect(res.status).toBe(401);
  });

  it("creates an event owned by the authenticated user, ignoring any organiserId in the body", async () => {
    const now = new Date();
    vi.mocked(prisma.event.create).mockResolvedValue({
      id: "evt-1",
      organiserId: "user-1",
      name: "Test Concert",
      date: new Date(futureDate),
      venue: "Main Hall",
      priceCents: 2500,
      createdAt: now,
    });
    vi.mocked(prisma.seat.createMany).mockResolvedValue({ count: 10 });

    const res = await request(app)
      .post("/api/events")
      .set("Authorization", authHeader)
      .send({
        name: "Test Concert",
        date: futureDate,
        venue: "Main Hall",
        priceCents: 2500,
        seatCount: 10,
        organiserId: "someone-else",
      });

    expect(res.status).toBe(201);
    expect(res.body.seatCounts).toEqual({ available: 10, held: 0, booked: 0 });
    const createCall = vi.mocked(prisma.event.create).mock.calls[0]?.[0];
    expect(createCall?.data.organiserId).toBe("user-1");
  });

  it("returns 400 for a past date", async () => {
    const res = await request(app)
      .post("/api/events")
      .set("Authorization", authHeader)
      .send({
        name: "Past Event",
        date: "2020-01-01T00:00:00.000Z",
        venue: "X",
        priceCents: 100,
        seatCount: 10,
      });
    expect(res.status).toBe(400);
  });

  it("returns 400 for seatCount out of bounds", async () => {
    const tooFew = await request(app)
      .post("/api/events")
      .set("Authorization", authHeader)
      .send({ name: "X", date: futureDate, venue: "X", priceCents: 100, seatCount: 0 });
    expect(tooFew.status).toBe(400);

    const tooMany = await request(app)
      .post("/api/events")
      .set("Authorization", authHeader)
      .send({ name: "X", date: futureDate, venue: "X", priceCents: 100, seatCount: 501 });
    expect(tooMany.status).toBe(400);
  });
});

describe("GET /api/events", () => {
  it("returns 401 with no auth header", async () => {
    const res = await request(app).get("/api/events");
    expect(res.status).toBe(401);
  });

  it("returns paginated events with defaults", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([]);
    vi.mocked(prisma.event.count).mockResolvedValue(0);

    const res = await request(app).get("/api/events").set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], page: 1, limit: 20, total: 0 });
  });

  it("reflects page/limit query params in the response", async () => {
    vi.mocked(prisma.event.findMany).mockResolvedValue([]);
    vi.mocked(prisma.event.count).mockResolvedValue(0);

    const res = await request(app)
      .get("/api/events?page=2&limit=5")
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], page: 2, limit: 5, total: 0 });
  });
});

describe("GET /api/events/:id", () => {
  it("returns 401 with no auth header", async () => {
    const res = await request(app).get("/api/events/evt-1");
    expect(res.status).toBe(401);
  });

  it("returns event detail with seat counts", async () => {
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

    const res = await request(app).get("/api/events/evt-1").set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.seatCounts).toEqual({ available: 5, held: 2, booked: 1 });
  });

  it("returns 404 for a nonexistent event", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

    const res = await request(app).get("/api/events/missing").set("Authorization", authHeader);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/events/:id/seats", () => {
  it("returns 401 with no auth header", async () => {
    const res = await request(app).get("/api/events/evt-1/seats");
    expect(res.status).toBe(401);
  });

  it("returns the full seat list as a plain array, filtered by status", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({ id: "evt-1" } as never);
    vi.mocked(prisma.seat.findMany).mockResolvedValue([
      { id: "seat-1", label: "1", status: "held" },
    ] as never);

    const res = await request(app)
      .get("/api/events/evt-1/seats?status=held")
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: "seat-1", label: "1", status: "held" }]);
    expect(prisma.seat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: "evt-1", status: "held" } }),
    );
    expect(prisma.seat.count).not.toHaveBeenCalled();
  });

  it("returns 404 for a nonexistent event", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null);

    const res = await request(app)
      .get("/api/events/missing/seats")
      .set("Authorization", authHeader);
    expect(res.status).toBe(404);
  });
});
