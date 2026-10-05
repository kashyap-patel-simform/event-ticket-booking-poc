import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, MapPin, Ticket } from "lucide-react";
import { Link, useParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import SeatGrid from "@/features/events/components/SeatGrid";
import { useEventQuery } from "@/features/events/hooks/useEventQuery";
import { useSeatsQuery } from "@/features/events/hooks/useSeatsQuery";
import { useSeatsStream } from "@/features/events/hooks/useSeatsStream";
import { useActiveHoldQuery } from "@/features/holds/hooks/useActiveHoldQuery";
import { useCancelHoldMutation } from "@/features/holds/hooks/useCancelHoldMutation";
import { useCountdown } from "@/features/holds/hooks/useCountdown";
import { useCreateHoldMutation } from "@/features/holds/hooks/useCreateHoldMutation";
import { MAX_SEATS_PER_HOLD } from "@/features/holds/schemas/holds.schemas";
import { useCreateCheckoutMutation } from "@/features/payments/hooks/useCreateCheckoutMutation";
import { useEventBookingsQuery } from "@/features/payments/hooks/useEventBookingsQuery";
import { ApiError } from "@/lib/api-client";
import { formatDate, formatPriceCents } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data: event, isPending: isEventPending, isError: isEventError } = useEventQuery(eventId);
  const { data: seats, isPending: isSeatsPending } = useSeatsQuery(eventId);
  useSeatsStream(eventId);

  const { data: currentUser } = useCurrentUser();
  const isOwner = !!event && !!currentUser && event.organiserId === currentUser.id;
  const {
    data: eventBookings,
    isPending: isEventBookingsPending,
    isError: isEventBookingsError,
  } = useEventBookingsQuery(eventId, isOwner);

  const [selectedSeatIds, setSelectedSeatIds] = useState<Set<string>>(new Set());
  // Sourced from the server (not local-only state) so a refresh — or a browser-back from Stripe —
  // still shows "Held — Pay Now" for a hold that's still valid, instead of losing track of it.
  const { data: activeHold, isPending: isActiveHoldPending } = useActiveHoldQuery(eventId);

  const createHoldMutation = useCreateHoldMutation(eventId ?? "");
  const cancelHoldMutation = useCancelHoldMutation(eventId ?? "");
  const createCheckoutMutation = useCreateCheckoutMutation();
  const { isExpired, label: countdownLabel } = useCountdown(activeHold?.expiresAt ?? "");
  // Derived, not stored: once expired, treat as if there's no hold at all — no effect needed to
  // "reset" it. The previous seat selection is left intact as a one-click retry affordance.
  const hasActiveHold = !!activeHold && !isExpired;
  const holdJustExpired = !!activeHold && isExpired;

  const queryClient = useQueryClient();
  // The countdown reaching zero is purely a client-side timer — it doesn't tell the server
  // anything. Without this, the seat the user was holding keeps showing as "held" (SeatGrid
  // renders by seat.status, not by whether the countdown ran out) until something else happens to
  // re-read this event's seats, e.g. a manual reload. Refetch right when it expires so the
  // server's own lazy-expiry sweep runs and the seat/hold state actually catches up.
  useEffect(() => {
    if (!holdJustExpired || !eventId) return;
    queryClient.invalidateQueries({ queryKey: queryKeys.events.seats(eventId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.holds.mine(eventId) });
  }, [holdJustExpired, eventId, queryClient]);

  // A selected seat can go stale — someone else holds/books it while this user is still deciding
  // (via the SSE stream) or a hold request partially fails. It then renders as a disabled,
  // non-interactive seat, so the user has no way to deselect it themselves; drop it from the
  // effective selection here (derived, not written back to state) so the count/total and the
  // hold request never get stuck on a seat that's no longer selectable.
  const availableSeatIds = new Set(
    (seats ?? []).filter((seat) => seat.status === "available").map((seat) => seat.id),
  );
  const effectiveSelectedSeatIds = new Set(
    [...selectedSeatIds].filter((id) => availableSeatIds.has(id)),
  );

  function toggleSeat(seatId: string) {
    setSelectedSeatIds((prev) => {
      const next = new Set(prev);
      if (next.has(seatId)) {
        next.delete(seatId);
      } else {
        if (next.size >= MAX_SEATS_PER_HOLD) return prev;
        next.add(seatId);
      }
      return next;
    });
  }

  function handleHoldSeats() {
    createHoldMutation.mutate(Array.from(effectiveSelectedSeatIds));
  }

  function handlePayNow() {
    if (!hasActiveHold || !activeHold) return;
    createCheckoutMutation.mutate(activeHold.id);
  }

  function handleCancelHold() {
    if (!hasActiveHold || !activeHold) return;
    cancelHoldMutation.mutate(activeHold.id);
  }

  const selectedCount = effectiveSelectedSeatIds.size;
  const selectedTotalCents = event ? event.priceCents * selectedCount : 0;
  const gridSelectedSeatIds = hasActiveHold
    ? new Set(activeHold!.seats.map((seat) => seat.id))
    : effectiveSelectedSeatIds;

  return (
    <div className="p-6">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Events
      </Link>

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
                maxSelectable={MAX_SEATS_PER_HOLD}
              />
            )}

            {holdJustExpired && (
              <p className="mt-4 text-sm text-destructive">
                Your hold expired — please reselect your seats.
              </p>
            )}

            {seats && !isActiveHoldPending && !hasActiveHold && (
              <div className="mt-6 flex items-center justify-between gap-4 border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  {selectedCount > 0
                    ? `${selectedCount} seat${selectedCount > 1 ? "s" : ""} selected · ${formatPriceCents(selectedTotalCents)}${
                        selectedCount >= MAX_SEATS_PER_HOLD
                          ? ` · limit of ${MAX_SEATS_PER_HOLD} reached`
                          : ""
                      }`
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCancelHold}
                    disabled={cancelHoldMutation.isPending || createCheckoutMutation.isPending}
                  >
                    {cancelHoldMutation.isPending ? "Cancelling…" : "Cancel Hold"}
                  </Button>
                  <Button
                    onClick={handlePayNow}
                    disabled={createCheckoutMutation.isPending || cancelHoldMutation.isPending}
                  >
                    {createCheckoutMutation.isPending ? "Redirecting…" : "Pay Now"}
                  </Button>
                </div>
              </div>
            )}

            {cancelHoldMutation.isError && (
              <p className="mt-2 text-sm text-destructive">
                {cancelHoldMutation.error instanceof ApiError
                  ? cancelHoldMutation.error.message
                  : "Something went wrong. Please try again."}
              </p>
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

      {isOwner && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {isEventBookingsPending && (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            )}
            {isEventBookingsError && (
              <p className="text-sm text-destructive">Failed to load bookings.</p>
            )}
            {eventBookings && eventBookings.length === 0 && (
              <p className="text-sm text-muted-foreground">No bookings yet.</p>
            )}
            <div className="divide-y">
              {eventBookings?.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between gap-4 py-3 text-sm first:pt-0 last:pb-0"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium text-foreground">{booking.buyer.name}</p>
                    <p className="text-muted-foreground">{booking.buyer.email}</p>
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Ticket className="size-4" />
                      {booking.ticketReference} · Seats:{" "}
                      {booking.seats.map((seat) => seat.label).join(", ")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-medium text-foreground">
                      {formatPriceCents(booking.amountCents)}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{booking.status}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(booking.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default EventDetailPage;
