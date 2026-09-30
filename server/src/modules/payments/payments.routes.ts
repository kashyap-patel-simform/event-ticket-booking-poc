import { Router } from "express";
import { authGuard } from "../../shared/middleware/authGuard.js";
import {
  createCheckoutHandler,
  getCheckoutSessionStatusHandler,
  listMyBookingsHandler,
} from "./payments.controller.js";

// Mounted at /api/holds — checkout is an action on an existing hold, distinct from
// /api/events/:id/holds (hold creation) in holds.routes.ts.
export const checkoutRouter = Router();
checkoutRouter.post("/:holdId/checkout", authGuard, createCheckoutHandler);

export const bookingsRouter = Router();
bookingsRouter.get("/", authGuard, listMyBookingsHandler);

// Lets the post-redirect success page confirm what actually happened to *this* Stripe session,
// instead of guessing from "most recent booking" (see getCheckoutSessionStatus for why).
export const checkoutSessionsRouter = Router();
checkoutSessionsRouter.get("/:sessionId", authGuard, getCheckoutSessionStatusHandler);

// Note: the Stripe webhook handler is NOT exported here. It needs express.raw() instead of the
// app-wide express.json(), so it's wired directly in app.ts, registered before express.json().
