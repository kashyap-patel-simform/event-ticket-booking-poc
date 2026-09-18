import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { listEventsRequest } from "../api/events.api";

export function useEventsQuery(page: number, limit: number) {
  return useQuery({
    queryKey: queryKeys.events.list(page, limit),
    queryFn: () => listEventsRequest({ page, limit }),
  });
}
