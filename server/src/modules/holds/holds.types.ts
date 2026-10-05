import { z } from "zod";

// Business rule, not a capacity artifact — caps how many seats one hold request can claim at once.
export const MAX_SEATS_PER_HOLD = 10;

export const createHoldSchema = z.object({
  seatIds: z
    .array(z.string().min(1))
    .min(1, "seatIds must contain at least one seat")
    .max(MAX_SEATS_PER_HOLD, `seatIds must contain at most ${MAX_SEATS_PER_HOLD} seats`)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "seatIds must not contain duplicates",
    }),
});

export type CreateHoldInput = z.infer<typeof createHoldSchema>;

export interface HoldSeat {
  id: string;
  label: string;
}

export interface HoldResult {
  id: string;
  status: "active" | "expired" | "converted" | "released";
  expiresAt: Date;
  seats: HoldSeat[];
}
