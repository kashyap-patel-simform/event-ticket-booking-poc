import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { API_ROUTES } from "@/lib/api-routes";
import { getAuthToken } from "@/lib/auth-token";
import { env } from "@/lib/env";
import { queryKeys } from "@/lib/query-keys";
import type { SeatListItem, SeatStatus } from "../schemas/events.schemas";

interface SeatsUpdatedPayload {
  type: "seats.updated";
  seats: { id: string; status: SeatStatus }[];
}

// Subscribes to live seat-status updates for one event over SSE and patches the existing
// useSeatsQuery cache in place, so other viewers' grids update without a manual refresh. Native
// EventSource can't set an Authorization header, so the JWT travels as a query param instead —
// chosen over hand-rolled fetch+ReadableStream for the browser's free auto-reconnect. It doesn't
// replay events missed while disconnected (no Last-Event-ID support), so every `onopen`
// (including a reconnect's) also triggers one invalidateQueries as a full-resync substitute.
export function useSeatsStream(eventId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!eventId) return;

    const token = getAuthToken();
    if (!token) return;

    const url = `${env.apiBaseUrl}${API_ROUTES.EVENTS.SEATS_STREAM(eventId)}?token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);

    source.onopen = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.seats(eventId) });
    };

    source.addEventListener("seats.updated", (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as SeatsUpdatedPayload;
      const updates = new Map(payload.seats.map((seat) => [seat.id, seat.status]));

      queryClient.setQueryData(queryKeys.events.seats(eventId), (current?: SeatListItem[]) => {
        if (!current) return current;
        return current.map((seat) =>
          updates.has(seat.id) ? { ...seat, status: updates.get(seat.id)! } : seat,
        );
      });
    });

    return () => source.close();
  }, [eventId, queryClient]);
}
