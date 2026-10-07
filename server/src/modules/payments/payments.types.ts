export interface CheckoutSessionResult {
  checkoutUrl: string;
  paymentAttemptId: string;
}

export interface BookingListItem {
  id: string;
  eventId: string;
  eventName: string;
  eventDate: Date;
  ticketReference: string;
  status: "confirmed" | "refunded" | "cancelled";
  amountCents: number;
  currency: string;
  createdAt: Date;
  // Snapshotted at confirmation time (Booking.seatLabels), not read off the live Seat relation —
  // a cancelled booking's seats get freed for rebooking, which would otherwise make this
  // unrecoverable. See the field's comment in schema.prisma.
  seatLabels: string[];
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
  seatLabels: string[];
  buyer: { id: string; name: string; email: string };
}
