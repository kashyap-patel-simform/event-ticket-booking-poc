// Mirrors server/src/modules/payments/payments.types.ts's response shapes exactly — dates travel
// as ISO strings over the wire.
export interface CheckoutSessionResult {
  checkoutUrl: string;
  paymentAttemptId: string;
}

export interface Booking {
  id: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  ticketReference: string;
  status: "confirmed" | "refunded" | "cancelled";
  amountCents: number;
  currency: string;
  createdAt: string;
  // Snapshotted at confirmation time, not read off live seat data — a cancelled booking's seats
  // get freed for rebooking, which would otherwise make this unrecoverable afterward.
  seatLabels: string[];
}

export interface CheckoutSessionStatus {
  status: "pending" | "succeeded" | "failed" | "refunded";
  booking: Booking | null;
}

export interface EventBooking {
  id: string;
  ticketReference: string;
  status: "confirmed" | "refunded" | "cancelled";
  amountCents: number;
  currency: string;
  createdAt: string;
  seatLabels: string[];
  buyer: { id: string; name: string; email: string };
}
