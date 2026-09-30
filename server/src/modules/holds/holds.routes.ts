import { Router } from "express";
import { authGuard } from "../../shared/middleware/authGuard.js";
import { validate } from "../../shared/middleware/validate.js";
import { cancelHoldHandler, createHoldHandler, getActiveHoldHandler } from "./holds.controller.js";
import { createHoldSchema } from "./holds.types.js";

// mergeParams: true — needs `:id` from the parent mount path (/api/events/:id/holds).
export const holdsRouter = Router({ mergeParams: true });

holdsRouter.post("/", authGuard, validate(createHoldSchema), createHoldHandler);
// Lets the client recover its own in-progress hold after a refresh — see getActiveHoldForUser.
holdsRouter.get("/mine", authGuard, getActiveHoldHandler);

// Separate router, mounted at /api/holds (not /api/events/:id/holds) — cancelling only needs the
// holdId, same shape as payments.routes.ts's checkoutRouter which lives at the same base path.
export const holdActionsRouter = Router();
holdActionsRouter.post("/:holdId/cancel", authGuard, cancelHoldHandler);
