// Central registry of server API route paths — one place to avoid inline path strings (and their
// typos) scattered across every feature's *.api.ts file.
export const API_ROUTES = {
  AUTH: {
    LOGIN: "/api/auth/login",
    REGISTER: "/api/auth/register",
  },
} as const;
