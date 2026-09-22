// Mirrors server/src/modules/holds/holds.types.ts's response shape — dates travel as ISO strings.
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
