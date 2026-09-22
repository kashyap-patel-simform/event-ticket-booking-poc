import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { createHoldRequest } from "../api/holds.api";

export function useCreateHoldMutation(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (seatIds: string[]) => createHoldRequest(eventId, seatIds),
    // Refresh seat statuses either way: on success they just flipped to `held`; on a 409 someone
    // else's hold changed the grid too, and the user needs to see current reality before retrying.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.seats(eventId) });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.seats(eventId) });
    },
  });
}
