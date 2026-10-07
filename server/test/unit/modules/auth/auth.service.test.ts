import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/shared/lib/prisma.js", () => ({
  prisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { Prisma } from "../../../../src/generated/prisma/client.js";
import * as authService from "../../../../src/modules/auth/auth.service.js";
import { ConflictError, UnauthorizedError } from "../../../../src/shared/errors/AppError.js";
import { env } from "../../../../src/shared/lib/env.js";
import { prisma } from "../../../../src/shared/lib/prisma.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("auth.service register", () => {
  it("creates a user and returns a signed token", async () => {
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "user-1",
      name: "Jane Doe",
      email: "jane@example.com",
      passwordHash: "irrelevant-in-response",
      createdAt: new Date(),
    });

    const result = await authService.register({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "password123",
    });

    expect(result.user).toEqual({ id: "user-1", name: "Jane Doe", email: "jane@example.com" });
    const decoded = jwt.verify(result.token, env.JWT_SECRET) as jwt.JwtPayload;
    expect(decoded.sub).toBe("user-1");
    expect(decoded.exp).toBeDefined();

    const createCall = vi.mocked(prisma.user.create).mock.calls[0]?.[0];
    expect(createCall?.data.passwordHash).not.toBe("password123");
  });

  it("throws ConflictError when the email is already taken", async () => {
    vi.mocked(prisma.user.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`email`)",
        {
          code: "P2002",
          clientVersion: "6.12.0",
        },
      ),
    );

    await expect(
      authService.register({
        name: "Jane Doe",
        email: "jane@example.com",
        password: "password123",
      }),
    ).rejects.toThrow(ConflictError);
  });
});

describe("auth.service login", () => {
  it("logs in with correct credentials", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      name: "Jane Doe",
      email: "jane@example.com",
      passwordHash,
      createdAt: new Date(),
    });

    const result = await authService.login({ email: "jane@example.com", password: "password123" });

    expect(result.user).toEqual({ id: "user-1", name: "Jane Doe", email: "jane@example.com" });
  });

  it("rejects an unknown email and a wrong password with the same message", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    const unknownEmail = authService.login({ email: "ghost@example.com", password: "password123" });
    await expect(unknownEmail).rejects.toThrow(UnauthorizedError);
    await expect(unknownEmail).rejects.toThrow("Invalid email or password");

    const passwordHash = await bcrypt.hash("password123", 10);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: "user-1",
      name: "Jane Doe",
      email: "jane@example.com",
      passwordHash,
      createdAt: new Date(),
    });
    const wrongPassword = authService.login({
      email: "jane@example.com",
      password: "wrong-password",
    });
    await expect(wrongPassword).rejects.toThrow(UnauthorizedError);
    await expect(wrongPassword).rejects.toThrow("Invalid email or password");
  });
});

describe("auth.service refresh", () => {
  const user = {
    id: "user-1",
    name: "Jane Doe",
    email: "jane@example.com",
    passwordHash: "irrelevant",
    createdAt: new Date(),
  };

  it("rotates a valid refresh token and returns a new pair", async () => {
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "irrelevant-hash",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
      user,
    } as never);
    vi.mocked(prisma.refreshToken.create).mockResolvedValue({
      id: "rt-2",
      userId: "user-1",
      tokenHash: "new-hash",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
    });

    const result = await authService.refresh({ refreshToken: "raw-token" });

    expect(result.user).toEqual({ id: "user-1", name: "Jane Doe", email: "jane@example.com" });
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: "rt-1" },
      data: { revokedAt: expect.any(Date), replacedByTokenId: "rt-2" },
    });
  });

  it("rejects an unknown refresh token", async () => {
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(null);

    await expect(authService.refresh({ refreshToken: "ghost" })).rejects.toThrow(UnauthorizedError);
  });

  it("rejects an expired refresh token", async () => {
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "irrelevant-hash",
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
      user,
    } as never);

    await expect(authService.refresh({ refreshToken: "raw-token" })).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("detects reuse of an already-rotated token and revokes the whole family", async () => {
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "irrelevant-hash",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      revokedAt: new Date(),
      replacedByTokenId: "rt-2",
      createdAt: new Date(),
      user,
    } as never);

    await expect(authService.refresh({ refreshToken: "stolen-raw-token" })).rejects.toThrow(
      UnauthorizedError,
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

describe("auth.service logout", () => {
  it("revokes the presented refresh token", async () => {
    await authService.logout({ refreshToken: "raw-token" });

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: expect.any(String), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
