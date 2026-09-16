import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "../../../../src/shared/errors/AppError.js";
import { env } from "../../../../src/shared/lib/env.js";
import { authGuard } from "../../../../src/shared/middleware/authGuard.js";

function makeReq(header: string | undefined) {
  return { header: vi.fn().mockReturnValue(header), user: undefined } as unknown as Request;
}

describe("authGuard", () => {
  it("rejects a missing Authorization header", () => {
    const req = makeReq(undefined);
    const next = vi.fn();

    expect(() => authGuard(req, {} as Response, next)).toThrow(UnauthorizedError);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a malformed Authorization header", () => {
    const req = makeReq("not-a-bearer-token");
    const next = vi.fn();

    expect(() => authGuard(req, {} as Response, next)).toThrow(UnauthorizedError);
  });

  it("rejects an invalid signature", () => {
    const token = jwt.sign({ sub: "user-1" }, "a-completely-different-secret");
    const req = makeReq(`Bearer ${token}`);
    const next = vi.fn();

    expect(() => authGuard(req, {} as Response, next)).toThrow(UnauthorizedError);
  });

  it("rejects an expired token", () => {
    const token = jwt.sign({ sub: "user-1" }, env.JWT_SECRET, { expiresIn: -1 });
    const req = makeReq(`Bearer ${token}`);
    const next = vi.fn();

    expect(() => authGuard(req, {} as Response, next)).toThrow(UnauthorizedError);
  });

  it("attaches req.user and calls next() for a valid token", () => {
    const token = jwt.sign({ sub: "user-1" }, env.JWT_SECRET);
    const req = makeReq(`Bearer ${token}`);
    const next: NextFunction = vi.fn();

    authGuard(req, {} as Response, next);

    expect(req.user).toEqual({ id: "user-1" });
    expect(next).toHaveBeenCalledOnce();
  });
});
