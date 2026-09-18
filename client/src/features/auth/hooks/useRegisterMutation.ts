import { useMutation } from "@tanstack/react-query";
import { registerRequest } from "../api/auth.api";
import type { RegisterInput } from "../schemas/auth.schemas";
import { useAuthSuccess } from "./useAuthSuccess";

export function useRegisterMutation() {
  const onSuccess = useAuthSuccess();
  return useMutation({
    mutationFn: (input: RegisterInput) => registerRequest(input),
    onSuccess,
  });
}
