import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../../src/app.js";
import { HOLD_TTL_MS } from "../../../src/modules/holds/holds.service.js";
import { authHeaderFor, createEventWithSeats, createUser } from "./helpers.js";

// `shouldAdvanceTime` keeps real timers (used by the pg driver / supertest's server) ticking
// while only Date/Date.now are frozen at a value we control via vi.setSystemTime — the lazy
// expiry check in holds.service compares `new Date()` against a stored `expiresAt`, so this is
// enough to simulate "5 minutes later" without an actual 5-minute wait.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Hold expiry — lazy check-on-read (real DB)", () => {
  it("lets a new hold claim a seat once the previous hold's TTL has passed", async () => {
    const organiser = await createUser();
    const { event, seats } = await createEventWithSeats(organiser.id, 1);
    const [seat] = seats;
    const firstBuyer = await createUser();
    const secondBuyer = await createUser();

    const firstHold = await request(app)
      .post(`/api/events/${event.id}/holds`)
      .set("Authorization", authHeaderFor(firstBuyer.id))
      .send({ seatIds: [seat!.id] });
    expect(firstHold.status).toBe(201);

    vi.setSystemTime(Date.now() + HOLD_TTL_MS + 1000);

    const secondHold = await request(app)
      .post(`/api/events/${event.id}/holds`)
      .set("Authorization", authHeaderFor(secondBuyer.id))
      .send({ seatIds: [seat!.id] });

    expect(secondHold.status).toBe(201);
    expect(secondHold.body.id).not.toBe(firstHold.body.id);
  });

  it("reflects the release on the read path (GET seats), not just on a new hold attempt", async () => {
    const organiser = await createUser();
    const { event, seats } = await createEventWithSeats(organiser.id, 1);
    const [seat] = seats;
    const buyer = await createUser();

    const hold = await request(app)
      .post(`/api/events/${event.id}/holds`)
      .set("Authorization", authHeaderFor(buyer.id))
      .send({ seatIds: [seat!.id] });
    expect(hold.status).toBe(201);

    vi.setSystemTime(Date.now() + HOLD_TTL_MS + 1000);

    const seatsRes = await request(app)
      .get(`/api/events/${event.id}/seats`)
      .set("Authorization", authHeaderFor(buyer.id));

    const found = (seatsRes.body as { id: string; status: string }[]).find(
      (s) => s.id === seat!.id,
    );
    expect(found?.status).toBe("available");
  });
});
