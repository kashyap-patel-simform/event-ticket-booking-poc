import { Router } from "express";
import { authGuard } from "../../shared/middleware/authGuard.js";
import { validate } from "../../shared/middleware/validate.js";
import { createHoldHandler } from "./holds.controller.js";
import { createHoldSchema } from "./holds.types.js";

// mergeParams: true — needs `:id` from the parent mount path (/api/events/:id/holds).
export const holdsRouter = Router({ mergeParams: true });

holdsRouter.post("/", authGuard, validate(createHoldSchema), createHoldHandler);
