import { Ticket } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBookingsQuery } from "@/features/payments/hooks/useBookingsQuery";
import { formatDate, formatPriceCents } from "@/lib/format";

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

  useEffect(() => {
    if (isError) toast.error("Failed to load bookings.");
  }, [isError]);

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-semibold">My Bookings</h1>

      {bookings && bookings.length === 0 && (
        <p className="text-muted-foreground">No bookings yet.</p>
      )}

      <div className="space-y-4">
        {isPending
          ? Array.from({ length: 3 }, (_, i) => <BookingCardSkeleton key={i} />)
          : bookings?.map((booking) => (
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
                  <p>Seats: {booking.seats.map((seat) => seat.label).join(", ")}</p>
                  <p>
                    {formatPriceCents(booking.amountCents)} · {formatDate(booking.createdAt)}
                  </p>
                </CardContent>
              </Card>
            ))}
      </div>
    </div>
  );
}

export default BookingsPage;
