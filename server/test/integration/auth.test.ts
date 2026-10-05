import bcrypt from "bcryptjs";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/shared/lib/prisma.js", () => ({
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

import { app } from "../../src/app.js";
import { Prisma } from "../../src/generated/prisma/client.js";
import { prisma } from "../../src/shared/lib/prisma.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/register", () => {
  it("creates a user and returns a token", async () => {
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "user-1",
      name: "Jane Doe",
      email: "jane@example.com",
      passwordHash: "hashed",
      createdAt: new Date(),
    });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Jane Doe", email: "jane@example.com", password: "password123" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      token: expect.any(String),
      refreshToken: expect.any(String),
      user: { id: "user-1", name: "Jane Doe", email: "jane@example.com" },
    });
  });

  it("returns 409 for a duplicate email", async () => {
    vi.mocked(prisma.user.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`email`)",
        {
          code: "P2002",
          clientVersion: "6.12.0",
        },
      ),
    );

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Jane Doe", email: "jane@example.com", password: "password123" });

    expect(res.status).toBe(409);
  });

  it("returns 400 for an invalid body", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Jane Doe", email: "not-an-email", password: "short" });

    expect(res.status).toBe(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with correct credentials", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      name: "Jane Doe",
      email: "jane@example.com",
      passwordHash,
      createdAt: new Date(),
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "jane@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: "user-1", name: "Jane Doe", email: "jane@example.com" });
  });

  it("returns 401 for a wrong password", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      name: "Jane Doe",
      email: "jane@example.com",
      passwordHash,
      createdAt: new Date(),
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "jane@example.com", password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  it("returns 400 for a missing email", async () => {
    const res = await request(app).post("/api/auth/login").send({ password: "password123" });

    expect(res.status).toBe(400);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/refresh", () => {
  it("returns a new token pair for a valid refresh token", async () => {
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "irrelevant-hash",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
      user: {
        id: "user-1",
        name: "Jane Doe",
        email: "jane@example.com",
        passwordHash: "irrelevant",
        createdAt: new Date(),
      },
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

    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: "a-raw-refresh-token" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      token: expect.any(String),
      refreshToken: expect.any(String),
      user: { id: "user-1", name: "Jane Doe", email: "jane@example.com" },
    });
  });

  it("returns 401 for an unknown refresh token", async () => {
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(null);

    const res = await request(app).post("/api/auth/refresh").send({ refreshToken: "ghost" });

    expect(res.status).toBe(401);
  });

  it("returns 400 when refreshToken is missing", async () => {
    const res = await request(app).post("/api/auth/refresh").send({});

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the refresh token and returns 204", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .send({ refreshToken: "a-raw-refresh-token" });

    expect(res.status).toBe(204);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: expect.any(String), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("returns 400 when refreshToken is missing", async () => {
    const res = await request(app).post("/api/auth/logout").send({});

    expect(res.status).toBe(400);
  });
});
