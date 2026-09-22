import { apiFetch } from "@/lib/api-client";
import { API_ROUTES } from "@/lib/api-routes";
import type { Booking, CheckoutSessionResult } from "../schemas/payments.schemas";

export function createCheckoutRequest(holdId: string) {
  return apiFetch<CheckoutSessionResult>(API_ROUTES.HOLDS.CHECKOUT(holdId), { method: "POST" });
}

export function listBookingsRequest() {
  return apiFetch<Booking[]>(API_ROUTES.BOOKINGS.LIST);
}
