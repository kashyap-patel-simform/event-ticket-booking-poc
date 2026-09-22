import cors from "cors";
import express from "express";
import helmet from "helmet";
import { authRouter } from "./modules/auth/auth.routes.js";
import { eventsRouter } from "./modules/events/events.routes.js";
import { holdsRouter } from "./modules/holds/holds.routes.js";
import { stripeWebhookHandler } from "./modules/payments/payments.controller.js";
import { bookingsRouter, checkoutRouter } from "./modules/payments/payments.routes.js";
import { env } from "./shared/lib/env.js";
import { errorHandler } from "./shared/middleware/errorHandler.js";
import { requestLogger } from "./shared/middleware/requestLogger.js";

export const app = express();

app.use(helmet()); // secure default HTTP headers; CSP default is a no-op since this API serves no HTML

app.use(
  cors({
    origin: env.CLIENT_ORIGIN, // explicit origin, not "*" — required once Authorization headers are involved
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"], // Authorization must be listed or the preflight rejects it
  }),
); // no credentials:true — auth is a Bearer token, not cookies

app.use(requestLogger); // must run before routes/errorHandler so req.id/req.log exist everywhere

// Stripe's signature check needs the raw, unparsed request body. Registered with its own
// express.raw() BEFORE the global express.json() below — Express dispatches by registration
// order, so a request to this exact path is fully handled here and never reaches express.json().
// If this ran after (or express.json() had no path exclusion), the body would already be a
// parsed object by the time constructEvent() ran and signature verification would fail for every
// real webhook. This is also the one route in the app intentionally not behind authGuard — Stripe
// sends no user JWT; the trust boundary is the signature itself.
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/events", eventsRouter);
app.use("/api/events/:id/holds", holdsRouter);
app.use("/api/holds", checkoutRouter);
app.use("/api/bookings", bookingsRouter);

app.use(errorHandler);
