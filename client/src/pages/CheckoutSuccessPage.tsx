import { Ticket } from "lucide-react";
import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBookingsQuery } from "@/features/payments/hooks/useBookingsQuery";
import { formatPriceCents } from "@/lib/format";

function CheckoutSuccessPage() {
  const { data: bookings, isPending } = useBookingsQuery();
  // listMyBookings orders by createdAt desc, so the most recent booking is the one just paid for.
  const latestBooking = bookings?.[0];

  return (
    <div className="p-6 text-center">
      <h1 className="mb-2 text-xl font-semibold">Payment successful!</h1>
      <p className="mb-6 text-sm text-muted-foreground">Your seats are booked.</p>

      {isPending && <p className="text-muted-foreground">Loading your booking…</p>}

      {latestBooking && (
        <Card className="mx-auto max-w-sm text-left">
          <CardHeader>
            <CardTitle>{latestBooking.eventName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <Ticket className="size-4" />
              {latestBooking.ticketReference}
            </p>
            <p>Seats: {latestBooking.seats.map((seat) => seat.label).join(", ")}</p>
            <p>{formatPriceCents(latestBooking.amountCents)}</p>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 flex justify-center gap-3">
        <Link to="/bookings" className={buttonVariants({ variant: "outline" })}>
          My Bookings
        </Link>
        <Link to="/" className={buttonVariants()}>
          Back to Events
        </Link>
      </div>
    </div>
  );
}

export default CheckoutSuccessPage;
