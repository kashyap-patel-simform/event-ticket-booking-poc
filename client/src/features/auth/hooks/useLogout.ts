import { useQueryClient } from "@tanstack/react-query";
import { clearAuthSession, getRefreshToken } from "@/lib/auth-token";
import { queryKeys } from "@/lib/query-keys";
import { logoutRequest } from "../api/auth.api";

export function useLogout() {
  const queryClient = useQueryClient();
  return () => {
    const refreshToken = getRefreshToken();
    clearAuthSession();
    queryClient.setQueryData(queryKeys.auth.currentUser(), null);
    // Best-effort: revoke the refresh token server-side so it can't be used after logout. The
    // local session is already cleared above regardless of whether this call succeeds.
    if (refreshToken) {
      void logoutRequest(refreshToken).catch(() => undefined);
    }
  };
}
