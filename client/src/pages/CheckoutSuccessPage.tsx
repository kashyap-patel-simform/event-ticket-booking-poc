import { Loader2, Ticket } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCheckoutSessionStatusQuery } from "@/features/payments/hooks/useCheckoutSessionStatusQuery";
import { formatPriceCents } from "@/lib/format";

function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id") ?? undefined;
  const { data, isPending, isError } = useCheckoutSessionStatusQuery(sessionId);

  const actions = (
    <div className="mt-6 flex justify-center gap-3">
      <Link to="/bookings" className={buttonVariants({ variant: "outline" })}>
        My Bookings
      </Link>
      <Link to="/" className={buttonVariants()}>
        Back to Events
      </Link>
    </div>
  );

  // No session_id at all (shouldn't happen via the real Stripe redirect) or the session lookup
  // failed (e.g. stale/tampered URL) — there's nothing to confirm, so don't imply success.
  if (!sessionId || isError) {
    return (
      <div className="p-6 text-center">
        <h1 className="mb-2 text-xl font-semibold">We can't confirm this payment</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          We couldn't find a matching checkout session. If you completed a payment, check My
          Bookings — otherwise no charge was made.
        </p>
        {actions}
      </div>
    );
  }

  if (isPending || data?.status === "pending") {
    return (
      <div className="p-6 text-center">
        <Loader2 className="mx-auto mb-4 size-6 animate-spin text-muted-foreground" />
        <h1 className="mb-2 text-xl font-semibold">Confirming your payment…</h1>
        <p className="text-sm text-muted-foreground">This only takes a moment.</p>
      </div>
    );
  }

  if (data?.status === "succeeded" && data.booking) {
    const booking = data.booking;
    return (
      <div className="p-6 text-center">
        <h1 className="mb-2 text-xl font-semibold">Payment successful!</h1>
        <p className="mb-6 text-sm text-muted-foreground">Your seats are booked.</p>

        <Card className="mx-auto max-w-sm text-left">
          <CardHeader>
            <CardTitle>{booking.eventName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <Ticket className="size-4" />
              {booking.ticketReference}
            </p>
            <p>Seats: {booking.seats.map((seat) => seat.label).join(", ")}</p>
            <p>{formatPriceCents(booking.amountCents)}</p>
          </CardContent>
        </Card>

        {actions}
      </div>
    );
  }

  // status is "refunded" or "failed" — the hold expired (or otherwise couldn't be honored) before
  // this payment was confirmed. The card was auto-refunded server-side; no booking exists.
  return (
    <div className="p-6 text-center">
      <h1 className="mb-2 text-xl font-semibold">Your hold expired before payment completed</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Your seats were released and given up, so no booking was made. You have not been charged —
        any payment taken was automatically refunded.
      </p>
      {actions}
    </div>
  );
}

export default CheckoutSuccessPage;
