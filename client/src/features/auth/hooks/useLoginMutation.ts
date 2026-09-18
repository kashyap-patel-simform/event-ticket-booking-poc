import { useMutation } from "@tanstack/react-query";
import { loginRequest } from "../api/auth.api";
import type { LoginInput } from "../schemas/auth.schemas";
import { useAuthSuccess } from "./useAuthSuccess";

export function useLoginMutation() {
  const onSuccess = useAuthSuccess();
  return useMutation({
    mutationFn: (input: LoginInput) => loginRequest(input),
    onSuccess,
  });
}
