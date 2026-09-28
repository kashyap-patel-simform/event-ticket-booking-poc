import type { Response } from "express";
import { logger } from "./logger.js";

export interface SeatUpdate {
  id: string;
  status: "available" | "held" | "booked";
}

const subscribers = new Map<string, Set<Response>>();

export function subscribe(eventId: string, res: Response): void {
  let set = subscribers.get(eventId);
  if (!set) {
    set = new Set();
    subscribers.set(eventId, set);
  }
  set.add(res);
}

export function unsubscribe(eventId: string, res: Response): void {
  const set = subscribers.get(eventId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) subscribers.delete(eventId);
}

export function publishSeatsUpdated(eventId: string, seats: SeatUpdate[]): void {
  const set = subscribers.get(eventId);
  if (!set || set.size === 0 || seats.length === 0) return;
  const payload = JSON.stringify({ type: "seats.updated", seats });
  for (const res of set) {
    res.write(`event: seats.updated\ndata: ${payload}\n\n`);
  }
}

// Called once from server.ts during graceful shutdown — server.close()'s callback waits for
// every open connection to end, and a long-lived SSE response never ends on its own.
export function closeAllConnections(): void {
  for (const set of subscribers.values()) {
    for (const res of set) res.end();
  }
  subscribers.clear();
  logger.info("SSE hub: closed all open connections for shutdown");
}
