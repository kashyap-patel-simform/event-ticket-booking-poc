import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../../../../src/shared/errors/AppError.js";
import { errorHandler } from "../../../../src/shared/middleware/errorHandler.js";

function makeReqRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const logError = vi.fn();
  const req = {
    id: "req-123",
    log: { error: logError },
    path: "/api/whatever",
    method: "GET",
  } as unknown as Request;
  const res = { status } as unknown as Response;

  return { req, res, status, json, logError };
}

describe("errorHandler", () => {
  it("maps an AppError to its status code and does not log it as unhandled", () => {
    const { req, res, status, json, logError } = makeReqRes();
    const err = new NotFoundError("seat not found");

    errorHandler(err, req, res, vi.fn());

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ error: "seat not found", requestId: "req-123" });
    expect(logError).not.toHaveBeenCalled();
  });

  it("maps an unknown error to a 500 with a generic message, logging the original error", () => {
    const { req, res, status, json, logError } = makeReqRes();
    const err = new Error("something exploded");

    errorHandler(err, req, res, vi.fn());

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: "Internal server error", requestId: "req-123" });
    expect(logError).toHaveBeenCalledWith(
      "Unhandled error",
      expect.objectContaining({ err, path: "/api/whatever", method: "GET" }),
    );
  });
});
