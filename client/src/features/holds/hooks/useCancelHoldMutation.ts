import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { cancelHoldRequest } from "../api/holds.api";

export function useCancelHoldMutation(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (holdId: string) => cancelHoldRequest(holdId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.seats(eventId) });
      // Seed directly rather than invalidate — we already know the hold is gone, no need for a
      // round-trip just to confirm what this same request just did.
      queryClient.setQueryData(queryKeys.holds.mine(eventId), null);
    },
  });
}
