import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../../src/app.js";
import { prisma } from "../../../src/shared/lib/prisma.js";
import { authHeaderFor, createEventWithSeats, createUser } from "./helpers.js";

// Real Postgres (via testcontainers, see global-setup.ts) — this is the load-bearing test for
// the whole feature. Mocking prisma.$transaction (as the rest of the suite does) can only prove
// the code calls the right methods; it can't prove actual DB-level row locking prevents a
// double-booked seat under real concurrency.
describe("POST /api/events/:id/holds — concurrency (real DB)", () => {
  it("exactly one of two concurrent requests for the identical overlapping seat set wins", async () => {
    const organiser = await createUser();
    const { event, seats } = await createEventWithSeats(organiser.id, 3);
    const [seatA, seatB, seatC] = seats;
    const buyer1 = await createUser();
    const buyer2 = await createUser();

    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/events/${event.id}/holds`)
        .set("Authorization", authHeaderFor(buyer1.id))
        .send({ seatIds: [seatA!.id, seatB!.id] }),
      request(app)
        .post(`/api/events/${event.id}/holds`)
        .set("Authorization", authHeaderFor(buyer2.id))
        .send({ seatIds: [seatA!.id, seatB!.id] }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const winnerHoldId = res1.status === 201 ? res1.body.id : res2.body.id;
    const claimedSeats = await prisma.seat.findMany({
      where: { id: { in: [seatA!.id, seatB!.id] } },
    });
    expect(claimedSeats.every((s) => s.status === "held" && s.holdId === winnerHoldId)).toBe(true);

    const untouched = await prisma.seat.findUnique({ where: { id: seatC!.id } });
    expect(untouched?.status).toBe("available");
  });

  it("exactly one of five concurrent requests for the same seat set wins", async () => {
    const organiser = await createUser();
    const { event, seats } = await createEventWithSeats(organiser.id, 3);
    const buyers = await Promise.all(Array.from({ length: 5 }, () => createUser()));

    const results = await Promise.all(
      buyers.map((buyer) =>
        request(app)
          .post(`/api/events/${event.id}/holds`)
          .set("Authorization", authHeaderFor(buyer.id))
          .send({ seatIds: seats.map((s) => s.id) }),
      ),
    );

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);

    const winnerHoldId = results.find((r) => r.status === 201)!.body.id;
    const dbSeats = await prisma.seat.findMany({ where: { eventId: event.id } });
    expect(dbSeats.every((s) => s.status === "held" && s.holdId === winnerHoldId)).toBe(true);
  });

  it("two concurrent requests on disjoint seat sets both succeed", async () => {
    const organiser = await createUser();
    const { event, seats } = await createEventWithSeats(organiser.id, 4);
    const [seatA, seatB, seatC, seatD] = seats;
    const buyer1 = await createUser();
    const buyer2 = await createUser();

    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/events/${event.id}/holds`)
        .set("Authorization", authHeaderFor(buyer1.id))
        .send({ seatIds: [seatA!.id, seatB!.id] }),
      request(app)
        .post(`/api/events/${event.id}/holds`)
        .set("Authorization", authHeaderFor(buyer2.id))
        .send({ seatIds: [seatC!.id, seatD!.id] }),
    ]);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.id).not.toBe(res2.body.id);
  });
});
