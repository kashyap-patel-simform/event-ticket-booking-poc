// Central registry of TanStack Query keys for the whole app — one place so cache reads/writes
// across different features can't drift into colliding or duplicate key shapes.
export const queryKeys = {
  auth: {
    currentUser: () => ["auth", "currentUser"] as const,
  },
  events: {
    lists: () => ["events", "list"] as const,
    list: (page: number, limit: number) => ["events", "list", page, limit] as const,
    detail: (id: string) => ["events", "detail", id] as const,
    seats: (id: string) => ["events", "seats", id] as const,
  },
  bookings: {
    mine: () => ["bookings", "mine"] as const,
  },
} as const;
