import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../../src/app.js";
import { prisma } from "../../../src/shared/lib/prisma.js";
import { authHeaderFor, createEventWithSeats, createUser } from "./helpers.js";

describe("POST /api/events/:id/holds — all-or-nothing (real DB)", () => {
  it("rolls back the whole claim, leaving the other seats available, when one is already held", async () => {
    const organiser = await createUser();
    const { event, seats } = await createEventWithSeats(organiser.id, 3);
    const [seatA, seatB, seatC] = seats;

    const priorHolder = await createUser();
    const existingHold = await prisma.hold.create({
      data: {
        userId: priorHolder.id,
        status: "active",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await prisma.seat.update({
      where: { id: seatB!.id },
      data: { status: "held", holdId: existingHold.id },
    });

    const buyer = await createUser();
    const res = await request(app)
      .post(`/api/events/${event.id}/holds`)
      .set("Authorization", authHeaderFor(buyer.id))
      .send({ seatIds: [seatA!.id, seatB!.id, seatC!.id] });

    expect(res.status).toBe(409);
    expect(res.body.details.unavailableSeatIds).toEqual([seatB!.id]);

    const [dbA, dbC] = await Promise.all([
      prisma.seat.findUnique({ where: { id: seatA!.id } }),
      prisma.seat.findUnique({ where: { id: seatC!.id } }),
    ]);
    expect(dbA?.status).toBe("available");
    expect(dbA?.holdId).toBeNull();
    expect(dbC?.status).toBe("available");
    expect(dbC?.holdId).toBeNull();
  });
});
