import { Link, useSearchParams } from "react-router";
import { buttonVariants } from "@/components/ui/button";

function CheckoutCancelPage() {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get("eventId");

  return (
    <div className="p-6 text-center">
      <h1 className="mb-2 text-xl font-semibold">Payment cancelled</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Your payment was cancelled — no charge was made.
      </p>

      <Link
        to={eventId ? `/events/${eventId}` : "/"}
        className={buttonVariants({ variant: "outline" })}
      >
        {eventId ? "Back to Event" : "Back to Events"}
      </Link>
    </div>
  );
}

export default CheckoutCancelPage;
