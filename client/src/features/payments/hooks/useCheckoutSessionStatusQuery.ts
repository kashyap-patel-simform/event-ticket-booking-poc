import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getCheckoutSessionStatusRequest } from "../api/payments.api";

const POLL_INTERVAL_MS = 1500;

// Stripe's webhook is delivered asynchronously and can lag slightly behind the browser redirect,
// so the session can still be "pending" from our side for a moment right after landing on the
// success page. Poll until it resolves one way or the other (succeeded/refunded/failed) instead
// of showing a one-shot result that might just be "not processed yet".
export function useCheckoutSessionStatusQuery(sessionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.checkoutSessions.status(sessionId ?? ""),
    queryFn: () => getCheckoutSessionStatusRequest(sessionId!),
    enabled: !!sessionId,
    refetchInterval: (query) => (query.state.data?.status === "pending" ? POLL_INTERVAL_MS : false),
  });
}
