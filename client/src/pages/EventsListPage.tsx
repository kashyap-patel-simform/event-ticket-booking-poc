import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEventsQuery } from "@/features/events/hooks/useEventsQuery";
import { formatDateBadge, formatPriceCents } from "@/lib/format";

const LIMIT = 20;

function EventRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-4">
      <Skeleton className="h-12 w-14 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-4 w-20 shrink-0" />
    </div>
  );
}

function EventsListPage() {
  const [page, setPage] = useState(1);
  const { data, isPending, isError } = useEventsQuery(page, LIMIT);

  useEffect(() => {
    if (isError) toast.error("Failed to load events.");
  }, [isError]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-semibold">Events</h1>

      {data && data.data.length === 0 && <p className="text-muted-foreground">No events yet.</p>}

      <div className="divide-y divide-border">
        {isPending
          ? Array.from({ length: 5 }, (_, i) => <EventRowSkeleton key={i} />)
          : data?.data.map((event) => {
              const { month, day } = formatDateBadge(event.date);
              return (
                <Link
                  key={event.id}
                  to={`/events/${event.id}`}
                  className="flex items-center gap-4 py-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex w-14 shrink-0 flex-col items-center rounded-md bg-primary py-1.5 text-primary-foreground">
                    <span className="text-xs font-medium leading-none">{month}</span>
                    <span className="text-lg leading-tight font-bold">{day}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{event.name}</p>
                    <span className="text-sm text-muted-foreground">{event.venue}</span>
                  </div>
                  <p className="shrink-0 text-right text-sm text-muted-foreground">
                    {formatPriceCents(event.priceCents)} · {event.seatCount} seats
                  </p>
                </Link>
              );
            })}
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
