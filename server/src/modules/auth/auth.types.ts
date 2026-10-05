import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(1, "name is required"),
  email: z.string().email("must be a valid email"),
  password: z.string().min(8, "password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("must be a valid email"),
  password: z.string().min(1, "password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}
