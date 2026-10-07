import { Ticket } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBookingsQuery } from "@/features/payments/hooks/useBookingsQuery";
import { useCancelBookingMutation } from "@/features/payments/hooks/useCancelBookingMutation";
import type { Booking } from "@/features/payments/schemas/payments.schemas";
import { formatDate, formatPriceCents } from "@/lib/format";

const CANCELLATION_WINDOW_MS = 24 * 60 * 60 * 1000;

function BookingCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
    </Card>
  );
}

function BookingsPage() {
  const { data: bookings, isPending, isError } = useBookingsQuery();
  const cancelBookingMutation = useCancelBookingMutation();

  useEffect(() => {
    if (isError) toast.error("Failed to load bookings.");
  }, [isError]);

  function handleCancelBooking(booking: Booking) {
    const confirmed = window.confirm(
      `Cancel your booking for "${booking.eventName}" (seats ${booking.seatLabels.join(", ")})? ` +
        `${formatPriceCents(booking.amountCents)} will be refunded to your original payment method.`,
    );
    if (!confirmed) return;
    cancelBookingMutation.mutate({ bookingId: booking.id, eventId: booking.eventId });
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-semibold">My Bookings</h1>

      {bookings && bookings.length === 0 && (
        <p className="text-muted-foreground">No bookings yet.</p>
      )}

      <div className="space-y-4">
        {isPending
          ? Array.from({ length: 3 }, (_, i) => <BookingCardSkeleton key={i} />)
          : bookings?.map((booking) => {
              const withinCutoff =
                new Date(booking.eventDate).getTime() - Date.now() <= CANCELLATION_WINDOW_MS;
              const isCancellingThis =
                cancelBookingMutation.isPending &&
                cancelBookingMutation.variables?.bookingId === booking.id;

              return (
                <Card key={booking.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      <span>{booking.eventName}</span>
                      <span className="text-xs font-normal text-muted-foreground capitalize">
                        {booking.status}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <Ticket className="size-4" />
                      {booking.ticketReference}
                    </p>
                    <p>Seats: {booking.seatLabels.join(", ")}</p>
                    <p>
                      {formatPriceCents(booking.amountCents)} · {formatDate(booking.createdAt)}
                    </p>

                    {booking.status === "confirmed" && (
                      <div className="mt-3 flex items-center justify-between gap-4 border-t pt-3">
                        <p className="text-xs text-muted-foreground">
                          {withinCutoff ? "Cancellation closes 24h before the event" : null}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={withinCutoff || isCancellingThis}
                          onClick={() => handleCancelBooking(booking)}
                        >
                          {isCancellingThis ? "Cancelling…" : "Cancel Booking"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
      </div>
    </div>
  );
}

export default BookingsPage;
