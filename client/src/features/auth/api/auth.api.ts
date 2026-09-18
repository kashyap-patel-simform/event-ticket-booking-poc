import { apiFetch } from "@/lib/api-client";
import { API_ROUTES } from "@/lib/api-routes";
import type { AuthResponse, LoginInput, RegisterInput } from "../schemas/auth.schemas";

export function loginRequest(input: LoginInput) {
  return apiFetch<AuthResponse>(API_ROUTES.AUTH.LOGIN, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function registerRequest(input: RegisterInput) {
  return apiFetch<AuthResponse>(API_ROUTES.AUTH.REGISTER, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
