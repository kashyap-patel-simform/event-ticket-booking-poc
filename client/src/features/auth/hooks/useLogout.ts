import { useQueryClient } from "@tanstack/react-query";
import { clearAuthSession } from "@/lib/auth-token";
import { queryKeys } from "@/lib/query-keys";

export function useLogout() {
  const queryClient = useQueryClient();
  return () => {
    clearAuthSession();
    queryClient.setQueryData(queryKeys.auth.currentUser(), null);
  };
}
