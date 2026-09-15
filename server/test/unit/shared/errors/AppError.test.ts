import { describe, expect, it } from "vitest";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../../../src/shared/errors/AppError.js";

describe("AppError", () => {
  it("carries a custom message and status code", () => {
    const err = new AppError("custom message", 418);

    expect(err.message).toBe("custom message");
    expect(err.statusCode).toBe(418);
    expect(err.name).toBe("AppError");
    expect(err).toBeInstanceOf(Error);
  });

  it.each([
    [NotFoundError, 404, "Not found"],
    [ConflictError, 409, "Conflict"],
    [UnauthorizedError, 401, "Unauthorized"],
    [ForbiddenError, 403, "Forbidden"],
    [ValidationError, 400, "Invalid input"],
  ] as const)("%s defaults to status %i and message %j", (ErrorClass, statusCode, message) => {
    const err = new ErrorClass();

    expect(err.statusCode).toBe(statusCode);
    expect(err.message).toBe(message);
    expect(err.name).toBe(ErrorClass.name);
    expect(err).toBeInstanceOf(AppError);
  });

  it("lets subclasses override the default message", () => {
    const err = new NotFoundError("seat not found");

    expect(err.message).toBe("seat not found");
    expect(err.statusCode).toBe(404);
  });
});
