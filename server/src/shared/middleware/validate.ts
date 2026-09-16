import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { ValidationError } from "../errors/AppError.js";

export function validate(schema: ZodType, source: "body" | "query" = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const data = source === "query" ? req.query : req.body;
    const result = schema.safeParse(data);

    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join(", ");
      throw new ValidationError(message);
    }

    // req.query has no setter in Express 5 — store parsed query data separately instead of overwriting it.
    if (source === "query") {
      req.validatedQuery = result.data;
    } else {
      req.body = result.data;
    }

    next();
  };
}
