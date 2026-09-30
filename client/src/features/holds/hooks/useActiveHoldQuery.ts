import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getActiveHoldRequest } from "../api/holds.api";

// Recovers a hold that's still active server-side after a page refresh (or a browser-back from
// Stripe) — without this, "Held — Pay Now" only ever existed as client state set once, right
// after creating the hold, so a refresh made a perfectly valid hold invisible to its own owner.
export function useActiveHoldQuery(eventId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.holds.mine(eventId ?? ""),
    queryFn: () => getActiveHoldRequest(eventId!),
    enabled: !!eventId,
  });
}
