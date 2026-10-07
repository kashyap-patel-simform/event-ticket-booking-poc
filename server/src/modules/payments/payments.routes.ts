import { Router } from "express";
import { authGuard } from "../../shared/middleware/authGuard.js";
import {
  cancelBookingHandler,
  createCheckoutHandler,
  getCheckoutSessionStatusHandler,
  listEventBookingsHandler,
  listMyBookingsHandler,
} from "./payments.controller.js";

// Mounted at /api/holds — checkout is an action on an existing hold, distinct from
// /api/events/:id/holds (hold creation) in holds.routes.ts.
export const checkoutRouter = Router();
checkoutRouter.post("/:holdId/checkout", authGuard, createCheckoutHandler);

export const bookingsRouter = Router();
bookingsRouter.get("/", authGuard, listMyBookingsHandler);

// Mounted at /api/bookings alongside bookingsRouter — same "two Router instances, same base
// path" convention as checkoutRouter/holdActionsRouter both living at /api/holds.
export const bookingActionsRouter = Router();
bookingActionsRouter.post("/:bookingId/cancel", authGuard, cancelBookingHandler);

// Mounted at /api/events/:id/bookings (mergeParams) — the organiser-facing view of who's booked
// their event, distinct from bookingsRouter above (the buyer's own "my bookings" list).
export const eventBookingsRouter = Router({ mergeParams: true });
eventBookingsRouter.get("/", authGuard, listEventBookingsHandler);

// Lets the post-redirect success page confirm what actually happened to *this* Stripe session,
// instead of guessing from "most recent booking" (see getCheckoutSessionStatus for why).
export const checkoutSessionsRouter = Router();
checkoutSessionsRouter.get("/:sessionId", authGuard, getCheckoutSessionStatusHandler);

// Note: the Stripe webhook handler is NOT exported here. It needs express.raw() instead of the
// app-wide express.json(), so it's wired directly in app.ts, registered before express.json().
