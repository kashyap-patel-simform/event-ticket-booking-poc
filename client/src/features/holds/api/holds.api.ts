import { apiFetch } from "@/lib/api-client";
import { API_ROUTES } from "@/lib/api-routes";
import type { Hold } from "../schemas/holds.schemas";

export function createHoldRequest(eventId: string, seatIds: string[]) {
  return apiFetch<Hold>(API_ROUTES.EVENTS.HOLDS(eventId), {
    method: "POST",
    body: JSON.stringify({ seatIds }),
  });
}

export function getActiveHoldRequest(eventId: string) {
  return apiFetch<Hold | null>(API_ROUTES.EVENTS.ACTIVE_HOLD(eventId));
}
