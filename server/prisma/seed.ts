import bcrypt from "bcryptjs";
import { prisma } from "../src/shared/lib/prisma.js";

const SALT_ROUNDS = 10;
const SEED_PASSWORD = "Password123!";

const organisers = [
  { name: "Alice Bennett", email: "alice.bennett@venuehub.example" },
  { name: "Marcus Ortiz", email: "marcus.ortiz@venuehub.example" },
];

const events = [
  {
    organiser: "alice.bennett@venuehub.example",
    name: "Coldplay: Music of the Spheres World Tour",
    venue: "Wembley Stadium, London",
    date: "2027-06-12T19:00:00.000Z",
    priceCents: 8500,
    seatCount: 120,
  },
  {
    organiser: "alice.bennett@venuehub.example",
    name: "Hamilton",
    venue: "Victoria Palace Theatre, London",
    date: "2027-03-04T19:30:00.000Z",
    priceCents: 12000,
    seatCount: 80,
  },
  {
    organiser: "marcus.ortiz@venuehub.example",
    name: "Arijit Singh Live in Concert",
    venue: "Jawaharlal Nehru Stadium, Delhi",
    date: "2027-01-18T18:30:00.000Z",
    priceCents: 3000,
    seatCount: 200,
  },
  {
    organiser: "marcus.ortiz@venuehub.example",
    name: "Ed Sheeran: Mathematics Tour",
    venue: "Principality Stadium, Cardiff",
    date: "2027-07-09T19:00:00.000Z",
    priceCents: 9500,
    seatCount: 150,
  },
  {
    organiser: "marcus.ortiz@venuehub.example",
    name: "Trevor Noah: Off the Record",
    venue: "Royal Albert Hall, London",
    date: "2026-11-22T20:00:00.000Z",
    priceCents: 4500,
    seatCount: 60,
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);

  const organiserIdByEmail = new Map<string, string>();
  for (const organiser of organisers) {
    const user = await prisma.user.upsert({
      where: { email: organiser.email },
      update: {},
      create: { name: organiser.name, email: organiser.email, passwordHash },
    });
    organiserIdByEmail.set(organiser.email, user.id);
    console.log(`Organiser ready: ${user.name} <${user.email}>`);
  }

  for (const event of events) {
    const organiserId = organiserIdByEmail.get(event.organiser);
    if (!organiserId) {
      throw new Error(`No seeded organiser found for email ${event.organiser}`);
    }

    const existing = await prisma.event.findFirst({
      where: { organiserId, name: event.name },
    });
    if (existing) {
      console.log(`Skipping (already seeded): ${event.name}`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          organiserId,
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

  console.log(`\nSeed login for any organiser above: password "${SEED_PASSWORD}"`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
