import { apiFetch } from "@/lib/api-client";
import { API_ROUTES } from "@/lib/api-routes";
import type {
  CreateEventInput,
  EventDetail,
  EventListItem,
  PaginatedResult,
  SeatListItem,
} from "../schemas/events.schemas";

export function listEventsRequest(params: { page: number; limit: number }) {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  return apiFetch<PaginatedResult<EventListItem>>(`${API_ROUTES.EVENTS.LIST}?${query}`);
}

export function getEventRequest(id: string) {
  return apiFetch<EventDetail>(API_ROUTES.EVENTS.DETAIL(id));
}

export function listSeatsRequest(eventId: string) {
  return apiFetch<SeatListItem[]>(API_ROUTES.EVENTS.SEATS(eventId));
}

export function createEventRequest(input: CreateEventInput) {
  return apiFetch<EventDetail>(API_ROUTES.EVENTS.CREATE, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
