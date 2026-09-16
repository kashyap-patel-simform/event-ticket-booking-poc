import type { Request, Response } from "express";
import * as authService from "./auth.service.js";
import type { LoginInput, RegisterInput } from "./auth.types.js";

export async function registerHandler(req: Request, res: Response) {
  const result = await authService.register(req.body as RegisterInput);
  res.status(201).json(result);
}

export async function loginHandler(req: Request, res: Response) {
  const result = await authService.login(req.body as LoginInput);
  res.status(200).json(result);
}
