import { apiFetch } from "@/lib/api-client";
import { API_ROUTES } from "@/lib/api-routes";
import type {
  Booking,
  CheckoutSessionResult,
  CheckoutSessionStatus,
  EventBooking,
} from "../schemas/payments.schemas";

export function createCheckoutRequest(holdId: string) {
  return apiFetch<CheckoutSessionResult>(API_ROUTES.HOLDS.CHECKOUT(holdId), { method: "POST" });
}

export function listBookingsRequest() {
  return apiFetch<Booking[]>(API_ROUTES.BOOKINGS.LIST);
}

export function cancelBookingRequest(bookingId: string) {
  return apiFetch<void>(API_ROUTES.BOOKINGS.CANCEL(bookingId), { method: "POST" });
}

export function getCheckoutSessionStatusRequest(sessionId: string) {
  return apiFetch<CheckoutSessionStatus>(API_ROUTES.CHECKOUT_SESSIONS.STATUS(sessionId));
}

export function listEventBookingsRequest(eventId: string) {
  return apiFetch<EventBooking[]>(API_ROUTES.EVENTS.BOOKINGS(eventId));
}
