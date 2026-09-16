import type { Request, Response } from "express";
import * as eventsService from "./events.service.js";
import type { CreateEventInput, ListEventsQuery, ListSeatsQuery } from "./events.types.js";

export async function createEventHandler(req: Request, res: Response) {
  const organiserId = req.user!.id; // authGuard runs before this handler and always sets req.user
  const result = await eventsService.createEvent(organiserId, req.body as CreateEventInput);
  res.status(201).json(result);
}

export async function listEventsHandler(req: Request, res: Response) {
  const query = req.validatedQuery as ListEventsQuery;
  const result = await eventsService.listEvents(query);
  res.status(200).json(result);
}

export async function getEventHandler(req: Request, res: Response) {
  const result = await eventsService.getEventById(req.params.id as string);
  res.status(200).json(result);
}

export async function listSeatsHandler(req: Request, res: Response) {
  const query = req.validatedQuery as ListSeatsQuery;
  const result = await eventsService.listSeats(req.params.id as string, query);
  res.status(200).json(result);
}
