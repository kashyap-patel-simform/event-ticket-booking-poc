import { useState } from "react";
import { Link } from "react-router";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEventsQuery } from "@/features/events/hooks/useEventsQuery";
import { formatDate, formatPriceCents } from "@/lib/format";

const LIMIT = 20;

function EventsListPage() {
  const [page, setPage] = useState(1);
  const { data, isPending, isError } = useEventsQuery(page, LIMIT);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Events</h1>
        <Link to="/events/new" className={buttonVariants()}>
          Create Event
        </Link>
      </div>

      {isPending && <p className="text-muted-foreground">Loading events…</p>}
      {isError && <p className="text-destructive">Failed to load events.</p>}
      {data && data.data.length === 0 && <p className="text-muted-foreground">No events yet.</p>}

      <div className="grid grid-cols-2 gap-4">
        {data?.data.map((event) => (
          <Link key={event.id} to={`/events/${event.id}`}>
            <Card>
              <CardHeader>
                <CardTitle>{event.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>{formatDate(event.date)}</p>
                <p>{event.venue}</p>
                <p>
                  {formatPriceCents(event.priceCents)} · {event.seatCount} seats
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {data && data.total > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <Button
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export default EventsListPage;
