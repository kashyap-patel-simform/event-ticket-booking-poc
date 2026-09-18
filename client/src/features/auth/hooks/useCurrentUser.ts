import { useQuery } from "@tanstack/react-query";
import { getStoredUser } from "@/lib/auth-token";
import { queryKeys } from "@/lib/query-keys";

// Backed by localStorage rather than a server refetch — there's no /api/auth/me endpoint, so this
// is a "local cache posing as a query": the query cache holds data that originated from the
// server (the login/register response), with the queryFn as the source of truth for readers that
// mount before the cache has been seeded (e.g. after a page reload).
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.auth.currentUser(),
    queryFn: getStoredUser,
    staleTime: Infinity,
  });
}
