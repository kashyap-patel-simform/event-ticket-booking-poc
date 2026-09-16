import { z } from "zod";

const SEAT_STATUSES = ["available", "held", "booked"] as const;

export const createEventSchema = z.object({
  name: z.string().min(1, "name is required"),
  date: z.coerce.date().refine((d) => d.getTime() > Date.now(), {
    message: "date must be in the future",
  }),
  venue: z.string().min(1, "venue is required"),
  priceCents: z.number().int().positive("priceCents must be a positive integer"),
  seatCount: z
    .number()
    .int("seatCount must be an integer")
    .min(1, "seatCount must be at least 1")
    .max(500, "seatCount must be at most 500"),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const listEventsQuerySchema = paginationQuerySchema;

export const listSeatsQuerySchema = z.object({
  status: z.enum(SEAT_STATUSES).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
export type ListSeatsQuery = z.infer<typeof listSeatsQuerySchema>;

export interface SeatCounts {
  available: number;
  held: number;
  booked: number;
}

export interface EventDetail {
  id: string;
  organiserId: string;
  name: string;
  date: Date;
  venue: string;
  priceCents: number;
  createdAt: Date;
  seatCounts: SeatCounts;
}

export interface EventListItem {
  id: string;
  name: string;
  date: Date;
  venue: string;
  priceCents: number;
  organiserId: string;
  seatCount: number;
  createdAt: Date;
}

export interface SeatListItem {
  id: string;
  label: string;
  status: (typeof SEAT_STATUSES)[number];
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}
