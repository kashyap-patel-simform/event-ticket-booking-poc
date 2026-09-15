import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger.js";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const id = req.header("x-request-id") ?? randomUUID(); // trust caller-supplied ID for correlation, not for auth/security decisions
  req.id = id;
  req.log = logger.child({ requestId: id });
  res.setHeader("X-Request-Id", id);

  const startedAt = Date.now();
  res.on("finish", () => {
    req.log.info("request completed", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
}
