import { Calendar, MapPin, Ticket } from "lucide-react";
import { useParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SeatGrid from "@/features/events/components/SeatGrid";
import { useEventQuery } from "@/features/events/hooks/useEventQuery";
import { useSeatsQuery } from "@/features/events/hooks/useSeatsQuery";
import { formatDate, formatPriceCents } from "@/lib/format";

function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data: event, isPending: isEventPending, isError: isEventError } = useEventQuery(eventId);
  const { data: seats, isPending: isSeatsPending } = useSeatsQuery(eventId);

  return (
    <div className="p-6">
      {isEventPending && <p className="text-muted-foreground">Loading event…</p>}
      {isEventError && <p className="text-destructive">Event not found.</p>}

      {event && (
        <Card>
          <CardHeader>
            <CardTitle>{event.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <Calendar className="size-4" />
              {formatDate(event.date)}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="size-4" />
              {event.venue}
            </p>
            <p className="flex items-center gap-2">
              <Ticket className="size-4" />
              {formatPriceCents(event.priceCents)}
            </p>
          </CardContent>
        </Card>
      )}

      {event && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Seats</CardTitle>
          </CardHeader>
          <CardContent>
            {isSeatsPending && <p className="text-muted-foreground">Loading seats…</p>}
            {seats && <SeatGrid seats={seats} />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default EventDetailPage;
