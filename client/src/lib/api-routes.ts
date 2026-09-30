// Central registry of server API route paths — one place to avoid inline path strings (and their
// typos) scattered across every feature's *.api.ts file.
export const API_ROUTES = {
  AUTH: {
    LOGIN: "/api/auth/login",
    REGISTER: "/api/auth/register",
  },
  EVENTS: {
    LIST: "/api/events",
    CREATE: "/api/events",
    DETAIL: (id: string) => `/api/events/${id}`,
    SEATS: (id: string) => `/api/events/${id}/seats`,
    SEATS_STREAM: (id: string) => `/api/events/${id}/seats/stream`,
    HOLDS: (id: string) => `/api/events/${id}/holds`,
    ACTIVE_HOLD: (id: string) => `/api/events/${id}/holds/mine`,
  },
  HOLDS: {
    CHECKOUT: (holdId: string) => `/api/holds/${holdId}/checkout`,
  },
  BOOKINGS: {
    LIST: "/api/bookings",
  },
  CHECKOUT_SESSIONS: {
    STATUS: (sessionId: string) => `/api/checkout-sessions/${sessionId}`,
  },
} as const;
