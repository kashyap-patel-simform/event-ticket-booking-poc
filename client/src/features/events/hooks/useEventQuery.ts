import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getEventRequest } from "../api/events.api";

export function useEventQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.events.detail(id ?? ""),
    queryFn: () => getEventRequest(id!),
    enabled: !!id,
  });
}
