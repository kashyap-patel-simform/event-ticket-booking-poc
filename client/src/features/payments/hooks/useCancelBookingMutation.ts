import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { cancelBookingRequest } from "../api/payments.api";

// Takes { bookingId, eventId } rather than a bare string like useCancelHoldMutation — that hook
// is already scoped to one eventId via its own hook argument, but BookingsPage lists bookings
// across many events, so eventId has to travel with each call to know which event's seat map
// to invalidate.
export function useCancelBookingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: { bookingId: string; eventId: string }) =>
      cancelBookingRequest(vars.bookingId),
    onSuccess: (_data, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings.mine() });
      queryClient.invalidateQueries({ queryKey: queryKeys.events.seats(eventId) });
      toast.success("Booking cancelled — your refund has been initiated.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to cancel booking.");
    },
  });
}
