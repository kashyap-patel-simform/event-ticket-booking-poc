import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { setAuthSession } from "@/lib/auth-token";
import { queryKeys } from "@/lib/query-keys";
import type { AuthResponse } from "../schemas/auth.schemas";

// Shared by useLoginMutation and useRegisterMutation — both succeed the same way: persist the
// session, seed the current-user cache, redirect home.
export function useAuthSuccess() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return (data: AuthResponse) => {
    setAuthSession(data.token, data.user);
    queryClient.setQueryData(queryKeys.auth.currentUser(), data.user);
    navigate("/");
  };
}
