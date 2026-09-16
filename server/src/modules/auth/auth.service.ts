import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "../../generated/prisma/client.js";
import { ConflictError, UnauthorizedError } from "../../shared/errors/AppError.js";
import { env } from "../../shared/lib/env.js";
import { prisma } from "../../shared/lib/prisma.js";
import type { AuthResponse, LoginInput, RegisterInput } from "./auth.types.js";

const TOKEN_EXPIRY = "24h";
const SALT_ROUNDS = 10;

function issueToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
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
    token: issueToken(user.id),
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
    token: issueToken(user.id),
    user: { id: user.id, name: user.name, email: user.email },
  };
}
