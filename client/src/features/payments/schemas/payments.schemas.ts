// Mirrors server/src/modules/payments/payments.types.ts's response shapes exactly — dates travel
// as ISO strings over the wire.
export interface CheckoutSessionResult {
  checkoutUrl: string;
  paymentAttemptId: string;
}

export interface BookingSeat {
  id: string;
  label: string;
}

export interface Booking {
  id: string;
  eventId: string;
  eventName: string;
  ticketReference: string;
  status: "confirmed" | "refunded" | "cancelled";
  amountCents: number;
  currency: string;
  createdAt: string;
  seats: BookingSeat[];
}
