// Mirrors server/src/modules/holds/holds.types.ts's response shape — dates travel as ISO strings.

// Mirrors server/src/modules/holds/holds.types.ts's MAX_SEATS_PER_HOLD exactly.
export const MAX_SEATS_PER_HOLD = 10;

export interface HoldSeat {
  id: string;
  label: string;
}

export interface Hold {
  id: string;
  status: "active" | "expired" | "converted" | "released";
  expiresAt: string;
  seats: HoldSeat[];
}
