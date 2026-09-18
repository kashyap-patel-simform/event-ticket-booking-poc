import { z } from "zod";

// Mirrors server/src/modules/auth/auth.types.ts exactly — client and server are independent
// projects (no shared types package), so these are intentionally duplicated, not imported.
export const loginSchema = z.object({
  email: z.string().email("must be a valid email"),
  password: z.string().min(1, "password is required"),
});

export const registerSchema = z.object({
  name: z.string().min(1, "name is required"),
  email: z.string().email("must be a valid email"),
  password: z.string().min(8, "password must be at least 8 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}
