import { Router } from "express";
import { authGuard } from "../../shared/middleware/authGuard.js";
import { validate } from "../../shared/middleware/validate.js";
import {
  createEventHandler,
  getEventHandler,
  listEventsHandler,
  listSeatsHandler,
} from "./events.controller.js";
import { createEventSchema, listEventsQuerySchema, listSeatsQuerySchema } from "./events.types.js";

export const eventsRouter = Router();

eventsRouter.post("/", authGuard, validate(createEventSchema), createEventHandler);
eventsRouter.get("/", authGuard, validate(listEventsQuerySchema, "query"), listEventsHandler);
eventsRouter.get("/:id", authGuard, getEventHandler);
eventsRouter.get(
  "/:id/seats",
  authGuard,
  validate(listSeatsQuerySchema, "query"),
  listSeatsHandler,
);
