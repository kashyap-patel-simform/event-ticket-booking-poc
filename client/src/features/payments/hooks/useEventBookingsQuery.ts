import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { listEventBookingsRequest } from "../api/payments.api";

// `enabled` is passed in rather than inferred here — only the organiser who owns this event can
// call the endpoint (403 otherwise), and the caller already knows that from comparing the event's
// organiserId against the current user.
export function useEventBookingsQuery(eventId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.bookings.forEvent(eventId ?? ""),
    queryFn: () => listEventBookingsRequest(eventId!),
    enabled: !!eventId && enabled,
  });
}
