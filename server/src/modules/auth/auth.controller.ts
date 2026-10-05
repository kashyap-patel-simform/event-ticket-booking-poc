import type { Request, Response } from "express";
import * as authService from "./auth.service.js";
import type { LoginInput, LogoutInput, RefreshInput, RegisterInput } from "./auth.types.js";

export async function registerHandler(req: Request, res: Response) {
  const result = await authService.register(req.body as RegisterInput);
  res.status(201).json(result);
}

export async function loginHandler(req: Request, res: Response) {
  const result = await authService.login(req.body as LoginInput);
  res.status(200).json(result);
}

export async function refreshHandler(req: Request, res: Response) {
  const result = await authService.refresh(req.body as RefreshInput);
  res.status(200).json(result);
}

export async function logoutHandler(req: Request, res: Response) {
  await authService.logout(req.body as LogoutInput);
  res.status(204).send();
}
