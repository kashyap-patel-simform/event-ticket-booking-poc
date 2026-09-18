import { z } from "zod";

// Mirrors server/src/modules/events/events.types.ts's response shapes exactly — client and server
// are independent projects (no shared types package). Dates travel over the wire as ISO strings
// (JSON has no Date type), so these use `string`, not `Date`.
export interface EventListItem {
  id: string;
  name: string;
  date: string;
  venue: string;
  priceCents: number;
  organiserId: string;
  seatCount: number;
  createdAt: string;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

export interface SeatCounts {
  available: number;
  held: number;
  booked: number;
}

export interface EventDetail {
  id: string;
  organiserId: string;
  name: string;
  date: string;
  venue: string;
  priceCents: number;
  createdAt: string;
  seatCounts: SeatCounts;
}

export type SeatStatus = "available" | "held" | "booked";

export interface SeatListItem {
  id: string;
  label: string;
  status: SeatStatus;
}

// The form collects a friendly decimal price (e.g. 19.99), not the server's raw `priceCents` —
// the conversion happens at submit time, right before calling the API layer (which does use
// `priceCents`, matching the server's createEventSchema exactly).
export const createEventFormSchema = z.object({
  name: z.string().min(1, "name is required"),
  date: z.coerce.date().refine((d) => d.getTime() > Date.now(), {
    message: "date must be in the future",
  }),
  venue: z.string().min(1, "venue is required"),
  price: z.coerce.number().positive("price must be a positive number"),
  seatCount: z.coerce
    .number()
    .int("seatCount must be an integer")
    .min(1, "seatCount must be at least 1")
    .max(500, "seatCount must be at most 500"),
});

// z.coerce fields make the schema's *input* type (raw form values, before coercion) differ from
// its *output* type (after coercion) — react-hook-form needs both: TFieldValues for what
// `register()` actually binds to, and the resolver's transformed output for the submit handler.
export type CreateEventFormValues = z.input<typeof createEventFormSchema>;
export type CreateEventFormInput = z.output<typeof createEventFormSchema>;

export interface CreateEventInput {
  name: string;
  date: Date;
  venue: string;
  priceCents: number;
  seatCount: number;
}
