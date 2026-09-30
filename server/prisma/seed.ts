import bcrypt from "bcryptjs";
import { prisma } from "../src/shared/lib/prisma.js";

const SALT_ROUNDS = 10;
const SEED_PASSWORD = "Password123!";

// This app has no role field on User — "organiser" vs "regular user" is purely a matter of which
// account happens to own the seeded events. Any user can create events via the API too; these two
// buyers are just seeded without any of their own, so there's something to browse/hold/book
// against right away.
const ORGANISER = { name: "Alice Bennett", email: "alice.bennett@venuehub.example" };
const BUYERS = [
  { name: "Priya Sharma", email: "priya.sharma@example.com" },
  { name: "Daniel Kim", email: "daniel.kim@example.com" },
];

const events = [
  {
    name: "Coldplay: Music of the Spheres World Tour",
    venue: "Wembley Stadium, London",
    date: "2027-06-12T19:00:00.000Z",
    priceCents: 8500,
    seatCount: 120,
  },
  {
    name: "Hamilton",
    venue: "Victoria Palace Theatre, London",
    date: "2027-03-04T19:30:00.000Z",
    priceCents: 12000,
    seatCount: 80,
  },
  {
    name: "Arijit Singh Live in Concert",
    venue: "Jawaharlal Nehru Stadium, Delhi",
    date: "2027-01-18T18:30:00.000Z",
    priceCents: 3000,
    seatCount: 200,
  },
  {
    name: "Ed Sheeran: Mathematics Tour",
    venue: "Principality Stadium, Cardiff",
    date: "2027-07-09T19:00:00.000Z",
    priceCents: 9500,
    seatCount: 150,
  },
  {
    name: "Trevor Noah: Off the Record",
    venue: "Royal Albert Hall, London",
    date: "2027-02-22T20:00:00.000Z",
    priceCents: 4500,
    seatCount: 60,
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);

  const organiser = await prisma.user.upsert({
    where: { email: ORGANISER.email },
    update: {},
    create: { name: ORGANISER.name, email: ORGANISER.email, passwordHash },
  });
  console.log(`Organiser ready: ${organiser.name} <${organiser.email}>`);

  for (const buyer of BUYERS) {
    const user = await prisma.user.upsert({
      where: { email: buyer.email },
      update: {},
      create: { name: buyer.name, email: buyer.email, passwordHash },
    });
    console.log(`Buyer ready: ${user.name} <${user.email}>`);
  }

  for (const event of events) {
    const existing = await prisma.event.findFirst({
      where: { organiserId: organiser.id, name: event.name },
    });
    if (existing) {
      console.log(`Skipping (already seeded): ${event.name}`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          organiserId: organiser.id,
          name: event.name,
          date: new Date(event.date),
          venue: event.venue,
          priceCents: event.priceCents,
        },
      });

      await tx.seat.createMany({
        data: Array.from({ length: event.seatCount }, (_, i) => ({
          eventId: created.id,
          label: String(i + 1),
        })),
      });
    });

    console.log(`Created: ${event.name} (${event.seatCount} seats)`);
  }

  console.log(`\nSeed login for any account above: password "${SEED_PASSWORD}"`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
