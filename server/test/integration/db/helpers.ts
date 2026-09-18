import jwt from "jsonwebtoken";
import { env } from "../../../src/shared/lib/env.js";
import { prisma } from "../../../src/shared/lib/prisma.js";

let counter = 0;

export async function createUser() {
  const suffix = `${Date.now()}-${counter++}`;
  return prisma.user.create({
    data: {
      email: `user-${suffix}@example.com`,
      name: "Test User",
      passwordHash: "not-a-real-hash", // these tests never exercise login, just the FK
    },
  });
}

export function authHeaderFor(userId: string) {
  return `Bearer ${jwt.sign({ sub: userId }, env.JWT_SECRET)}`;
}

export async function createEventWithSeats(organiserId: string, seatCount: number) {
  const event = await prisma.event.create({
    data: {
      organiserId,
      name: "Test Concert",
      date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      venue: "Main Hall",
      priceCents: 2500,
    },
  });
  await prisma.seat.createMany({
    data: Array.from({ length: seatCount }, (_, i) => ({
      eventId: event.id,
      label: String(i + 1),
    })),
  });
  const seats = await prisma.seat.findMany({ where: { eventId: event.id }, orderBy: { id: "asc" } });
  return { event, seats };
}
