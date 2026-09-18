const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): StoredUser | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as StoredUser) : null;
}

// There's no /api/auth/me endpoint to refetch the user on page reload — login/register are the
// only two auth endpoints — so the user object from their response is persisted here alongside
// the token, letting the session survive a refresh without a server round-trip.
export function setAuthSession(token: string, user: StoredUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
