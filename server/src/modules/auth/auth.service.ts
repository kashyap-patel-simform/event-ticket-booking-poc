import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "../../generated/prisma/client.js";
import { ConflictError, UnauthorizedError } from "../../shared/errors/AppError.js";
import { env } from "../../shared/lib/env.js";
import { prisma } from "../../shared/lib/prisma.js";
import type {
  AuthResponse,
  LoginInput,
  LogoutInput,
  RefreshInput,
  RegisterInput,
} from "./auth.types.js";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SALT_ROUNDS = 10;

function issueAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

async function issueRefreshToken(userId: string): Promise<string> {
  const rawToken = randomBytes(32).toString("hex");
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return rawToken;
}

async function issueTokenPair(userId: string): Promise<{ token: string; refreshToken: string }> {
  return {
    token: issueAccessToken(userId),
    refreshToken: await issueRefreshToken(userId),
  };
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  let user;
  try {
    user = await prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ConflictError("An account with this email already exists");
    }
    throw err;
  }

  return {
    ...(await issueTokenPair(user.id)),
    user: { id: user.id, name: user.name, email: user.email },
  };
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const invalidCredentials = new UnauthorizedError("Invalid email or password");

  if (!user) {
    throw invalidCredentials;
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw invalidCredentials;
  }

  return {
    ...(await issueTokenPair(user.id)),
    user: { id: user.id, name: user.name, email: user.email },
  };
}

export async function refresh(input: RefreshInput): Promise<AuthResponse> {
  const invalid = new UnauthorizedError("Invalid or expired refresh token");
  const tokenHash = hashToken(input.refreshToken);

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!stored) {
    throw invalid;
  }

  if (stored.revokedAt) {
    // Reuse of an already-rotated token: the raw token has leaked. Revoke the whole family so a
    // stolen refresh token can't keep minting new sessions once rotation detects it.
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw invalid;
  }

  if (stored.expiresAt < new Date()) {
    throw invalid;
  }

  const newRefreshToken = randomBytes(32).toString("hex");
  const newRow = await prisma.refreshToken.create({
    data: {
      userId: stored.userId,
      tokenHash: hashToken(newRefreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date(), replacedByTokenId: newRow.id },
  });

  return {
    token: issueAccessToken(stored.userId),
    refreshToken: newRefreshToken,
    user: { id: stored.user.id, name: stored.user.name, email: stored.user.email },
  };
}

export async function logout(input: LogoutInput): Promise<void> {
  const tokenHash = hashToken(input.refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
