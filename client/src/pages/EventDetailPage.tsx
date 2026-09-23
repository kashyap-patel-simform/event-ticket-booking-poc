import { useState } from "react";
import { Calendar, MapPin, Ticket } from "lucide-react";
import { useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import SeatGrid from "@/features/events/components/SeatGrid";
import { useEventQuery } from "@/features/events/hooks/useEventQuery";
import { useSeatsQuery } from "@/features/events/hooks/useSeatsQuery";
import { useCountdown } from "@/features/holds/hooks/useCountdown";
import { useCreateHoldMutation } from "@/features/holds/hooks/useCreateHoldMutation";
import type { Hold } from "@/features/holds/schemas/holds.schemas";
import { useCreateCheckoutMutation } from "@/features/payments/hooks/useCreateCheckoutMutation";
import { ApiError } from "@/lib/api-client";
import { formatDate, formatPriceCents } from "@/lib/format";

function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data: event, isPending: isEventPending, isError: isEventError } = useEventQuery(eventId);
  const { data: seats, isPending: isSeatsPending } = useSeatsQuery(eventId);

  const [selectedSeatIds, setSelectedSeatIds] = useState<Set<string>>(new Set());
  const [activeHold, setActiveHold] = useState<Hold | null>(null);

  const createHoldMutation = useCreateHoldMutation(eventId ?? "");
  const createCheckoutMutation = useCreateCheckoutMutation();
  const { isExpired, label: countdownLabel } = useCountdown(activeHold?.expiresAt ?? "");
  // Derived, not stored: once expired, treat as if there's no hold at all — no effect needed to
  // "reset" it. The previous seat selection is left intact as a one-click retry affordance.
  const hasActiveHold = !!activeHold && !isExpired;
  const holdJustExpired = !!activeHold && isExpired;

  function toggleSeat(seatId: string) {
    setSelectedSeatIds((prev) => {
      const next = new Set(prev);
      if (next.has(seatId)) {
        next.delete(seatId);
      } else {
        next.add(seatId);
      }
      return next;
    });
  }

  function handleHoldSeats() {
    createHoldMutation.mutate(Array.from(selectedSeatIds), {
      onSuccess: (hold) => setActiveHold(hold),
    });
  }

  function handlePayNow() {
    if (!hasActiveHold || !activeHold) return;
    createCheckoutMutation.mutate(activeHold.id);
  }

  const selectedCount = selectedSeatIds.size;
  const selectedTotalCents = event ? event.priceCents * selectedCount : 0;
  const gridSelectedSeatIds = hasActiveHold
    ? new Set(activeHold!.seats.map((seat) => seat.id))
    : selectedSeatIds;

  return (
    <div className="p-6">
      {isEventPending && (
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
          </CardContent>
        </Card>
      )}
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
            {isSeatsPending && (
              <div className="space-y-2">
                {Array.from({ length: 2 }, (_, row) => (
                  <div key={row} className="flex justify-center gap-2">
                    {Array.from({ length: 10 }, (_, seat) => (
                      <Skeleton key={seat} className="size-6 rounded" />
                    ))}
                  </div>
                ))}
              </div>
            )}
            {seats && (
              <SeatGrid
                seats={seats}
                selectedSeatIds={gridSelectedSeatIds}
                onToggleSeat={toggleSeat}
                disabled={hasActiveHold}
              />
            )}

            {holdJustExpired && (
              <p className="mt-4 text-sm text-destructive">
                Your hold expired — please reselect your seats.
              </p>
            )}

            {seats && !hasActiveHold && (
              <div className="mt-6 flex items-center justify-between gap-4 border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  {selectedCount > 0
                    ? `${selectedCount} seat${selectedCount > 1 ? "s" : ""} selected · ${formatPriceCents(selectedTotalCents)}`
                    : "Select seats to hold them"}
                </p>
                <Button
                  onClick={handleHoldSeats}
                  disabled={selectedCount === 0 || createHoldMutation.isPending}
                >
                  {createHoldMutation.isPending
                    ? "Holding…"
                    : selectedCount > 0
                      ? `Hold ${selectedCount} Seat${selectedCount > 1 ? "s" : ""}`
                      : "Hold Seats"}
                </Button>
              </div>
            )}

            {createHoldMutation.isError && (
              <p className="mt-2 text-sm text-destructive">
                {createHoldMutation.error instanceof ApiError
                  ? createHoldMutation.error.message
                  : "Something went wrong. Please try again."}
              </p>
            )}

            {hasActiveHold && (
              <div className="mt-6 flex items-center justify-between gap-4 border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  Held — expires in{" "}
                  <span className="font-medium text-foreground">{countdownLabel}</span>
                </p>
                <Button onClick={handlePayNow} disabled={createCheckoutMutation.isPending}>
                  {createCheckoutMutation.isPending ? "Redirecting…" : "Pay Now"}
                </Button>
              </div>
            )}

            {createCheckoutMutation.isError && (
              <p className="mt-2 text-sm text-destructive">
                {createCheckoutMutation.error instanceof ApiError
                  ? createCheckoutMutation.error.message
                  : "Something went wrong. Please try again."}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default EventDetailPage;
