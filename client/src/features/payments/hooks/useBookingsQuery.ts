import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { listBookingsRequest } from "../api/payments.api";

export function useBookingsQuery() {
  return useQuery({
    queryKey: queryKeys.bookings.mine(),
    queryFn: listBookingsRequest,
  });
}
