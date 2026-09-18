import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { listSeatsRequest } from "../api/events.api";

export function useSeatsQuery(eventId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.events.seats(eventId ?? ""),
    queryFn: () => listSeatsRequest(eventId!),
    enabled: !!eventId,
  });
}
