export interface CheckoutSessionResult {
  checkoutUrl: string;
  paymentAttemptId: string;
}

export interface BookingSeat {
  id: string;
  label: string;
}

export interface BookingListItem {
  id: string;
  eventId: string;
  eventName: string;
  ticketReference: string;
  status: "confirmed" | "refunded" | "cancelled";
  amountCents: number;
  currency: string;
  createdAt: Date;
  seats: BookingSeat[];
}

export interface CheckoutSessionStatusResult {
  status: "pending" | "succeeded" | "failed" | "refunded";
  booking: BookingListItem | null;
}

export interface EventBookingListItem {
  id: string;
  ticketReference: string;
  status: "confirmed" | "refunded" | "cancelled";
  amountCents: number;
  currency: string;
  createdAt: Date;
  seats: BookingSeat[];
  buyer: { id: string; name: string; email: string };
}
