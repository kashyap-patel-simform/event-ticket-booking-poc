import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../lib/env.js";
import { UnauthorizedError } from "../errors/AppError.js";

export function authGuard(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    throw new UnauthorizedError();
  }

  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new UnauthorizedError();
  }

  if (typeof payload === "string" || typeof payload.sub !== "string") {
    throw new UnauthorizedError();
  }

  req.user = { id: payload.sub };
  next();
}
