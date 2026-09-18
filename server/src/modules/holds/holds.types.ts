import { z } from "zod";

// Same cap as events.types.ts's seatCount — a hold can never name more seats than an event
// could possibly have.
export const MAX_HOLD_SEATS = 500;

export const createHoldSchema = z.object({
  seatIds: z
    .array(z.string().min(1))
    .min(1, "seatIds must contain at least one seat")
    .max(MAX_HOLD_SEATS, `seatIds must contain at most ${MAX_HOLD_SEATS} seats`)
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
