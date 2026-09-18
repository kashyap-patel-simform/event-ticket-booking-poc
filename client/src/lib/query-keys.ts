// Central registry of TanStack Query keys for the whole app — one place so cache reads/writes
// across different features can't drift into colliding or duplicate key shapes.
export const queryKeys = {
  auth: {
    currentUser: () => ["auth", "currentUser"] as const,
  },
} as const;
