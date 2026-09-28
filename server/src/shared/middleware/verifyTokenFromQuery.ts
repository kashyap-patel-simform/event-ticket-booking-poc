import jwt from "jsonwebtoken";
import { env } from "../lib/env.js";

// Native EventSource can't set an Authorization header, so the SSE stream route authenticates
// via a `?token=` query param instead of the header-based authGuard. This mirrors authGuard's
// jwt.verify check but returns null instead of throwing — the route needs to reject with a plain
// 401 *before* it writes SSE headers, not throw through errorHandler mid-stream.
export function verifyJwtFromQueryToken(token: unknown): string | null {
  if (typeof token !== "string" || token.length === 0) return null;

  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    return null;
  }

  if (typeof payload === "string" || typeof payload.sub !== "string") return null;
  return payload.sub;
}
