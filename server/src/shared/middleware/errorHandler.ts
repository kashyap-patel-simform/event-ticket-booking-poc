import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError.js";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, requestId: req.id });
    return;
  }

  req.log.error("Unhandled error", { err, path: req.path, method: req.method });
  res.status(500).json({ error: "Internal server error", requestId: req.id });
}
