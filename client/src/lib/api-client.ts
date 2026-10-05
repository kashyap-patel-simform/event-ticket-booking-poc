import { API_ROUTES } from "./api-routes";
import { clearAuthSession, getAuthToken, getRefreshToken, setTokenPair } from "./auth-token";
import { env } from "./env";

export class ApiError extends Error {
  status: number;
  requestId?: string;

  constructor(status: number, message: string, requestId?: string) {
    super(message);
    this.status = status;
    this.requestId = requestId;
  }
}

// Auth's own endpoints never go through the 401-refresh-and-retry flow below — a 401 from one of
// these means "this credential is actually bad" (wrong password, dead refresh token), not "the
// access token expired mid-session," so retrying would either loop or mask the real failure.
const AUTH_PATHS: string[] = [
  API_ROUTES.AUTH.LOGIN,
  API_ROUTES.AUTH.REGISTER,
  API_ROUTES.AUTH.REFRESH,
  API_ROUTES.AUTH.LOGOUT,
];

// Shared across concurrent 401s so a burst of requests that all expire together triggers exactly
// one refresh call, not one per request.
let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${env.apiBaseUrl}${API_ROUTES.AUTH.REFRESH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;

    const data = (await res.json()) as { token: string; refreshToken: string };
    setTokenPair(data.token, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

function redirectToLogin(): void {
  clearAuthSession();
  if (!window.location.pathname.startsWith("/login")) {
    window.location.href = "/login?sessionExpired=1";
  }
}

async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(`${env.apiBaseUrl}${path}`, { ...init, headers });
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  isRetry = false,
): Promise<T> {
  const res = await rawFetch(path, init);

  if (res.status === 401 && !isRetry && !AUTH_PATHS.includes(path)) {
    refreshPromise ??= refreshSession().finally(() => {
      refreshPromise = null;
    });
    const refreshed = await refreshPromise;

    if (refreshed) {
      return apiFetch<T>(path, init, true);
    }

    redirectToLogin();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error ?? res.statusText, body?.requestId);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
