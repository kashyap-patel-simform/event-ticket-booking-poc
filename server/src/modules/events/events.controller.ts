import type { Request, Response } from "express";
import { subscribe, unsubscribe } from "../../shared/lib/sse-hub.js";
import { verifyJwtFromQueryToken } from "../../shared/middleware/verifyTokenFromQuery.js";
import * as eventsService from "./events.service.js";
import type { CreateEventInput, ListEventsQuery, ListSeatsQuery } from "./events.types.js";

const SSE_HEARTBEAT_MS = 20_000;

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

// Not behind authGuard — EventSource can't set an Authorization header, so auth is a `?token=`
// query param verified by hand (see verifyTokenFromQuery.ts).
export function streamSeatsHandler(req: Request, res: Response) {
  const userId = verifyJwtFromQueryToken(req.query.token);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const eventId = req.params.id as string;

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  res.write(": connected\n\n");
  const heartbeat = setInterval(() => {
    res.write(": ping\n\n"); // keeps idle proxies/load balancers from timing out the connection
  }, SSE_HEARTBEAT_MS);

  subscribe(eventId, res);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe(eventId, res);
  });
}
