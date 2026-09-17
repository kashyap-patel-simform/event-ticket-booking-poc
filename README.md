# Event Booking POC

## Background

Two people buy the same seat because nothing actually reserves it while the first person is
paying, and abandoned checkouts leave half-created bookings that nobody ever cleans up. This
project is the booking system that fixes that: users browse events, pick a seat, and complete
payment against a hold that only one of them can win. Its center of gravity is what happens
*around* the payment, not the payment itself — the seat hold, its expiry, and reconciling a
booking with a payment outcome that can arrive late, arrive twice, or never arrive at all.

## Actors

| Role | Can do |
|---|---|
| **User** | Browse events, view availability, hold a seat, pay, view own bookings |
| **Organiser** | Create their own events/seat inventory, view bookings for their own events only |

## Core guarantees

- **Exactly one hold wins.** Two concurrent hold requests on the same seat — exactly one
  succeeds (201), the other is told the seat is unavailable (409). Enforced at the database
  level (conditional update / row lock), not in application memory.
- **Holds expire on their own.** An unconverted hold's seat becomes bookable again automatically,
  no manual cleanup.
- **Exactly-once booking finalisation.** A Stripe payment confirmation — even if late, or
  delivered twice (duplicate webhook) — finalises at most one booking with one ticket reference.
  A failed/abandoned payment leaves no partial booking behind.
- **No anonymous path.** Every hold, payment, and booking is tied to a real JWT-authenticated
  user; no anonymous access to any of it.
- **Data isolation.** A user sees only their own bookings; an organiser sees only their own
  events' bookings — enforced even against someone directly guessing another record's ID.
- **Traceability.** Every hold create/expire, payment outcome, refund outcome, and booking
  finalisation emits a structured log with correlation IDs, so "I paid and got nothing" is
  answerable from logs alone.

## Stack

| Concern | Choice |
|---|---|
| Backend | Express + TypeScript |
| Frontend | React + Vite + TypeScript |
| Database | PostgreSQL via Prisma |
| Auth | JWT (stateless, `Authorization: Bearer`) |
| Payments | Stripe (real test-mode integration — PaymentIntent/Checkout + webhook) |
| Logging | Winston, structured JSON with correlation IDs |
| Testing | Vitest (+ Supertest on the server) |
| Deploy target | `client/` → Vercel, `server/` → Render, DB → Supabase/Neon (free tiers) |

## Structure

Two independently-tooled projects, each with its own `package.json`/lockfile/`node_modules`:

- `server/` — Express + TypeScript API (Prisma/PostgreSQL, JWT auth, Stripe integration)
- `client/` — React + Vite + TypeScript SPA

## Getting started

### Server

```bash
cd server
cp .env.example .env   # fill in DATABASE_URL, etc.
npm install
npm run dev             # http://localhost:3000
```

### Client

```bash
cd client
npm install
npm run dev             # http://localhost:5173, proxies /api/* to the server
```

### Docker (both at once)

```bash
cp server/.env.example server/.env   # fill in DATABASE_URL, etc. — a Neon (or other Postgres) connection string
docker compose up
```

Brings up `server` (http://localhost:4000, proxied at container-internal port 3000) and `client`
(http://localhost:5173) together, with hot reload. Postgres itself isn't a compose service — both
containers connect out to whatever `DATABASE_URL`/`DIRECT_URL` point at in `server/.env` (Neon in
this project).

## Scripts (per project)

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm run typecheck` | Type-check only |
