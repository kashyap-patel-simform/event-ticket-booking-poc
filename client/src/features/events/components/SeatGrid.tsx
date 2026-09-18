import { Armchair } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SeatListItem, SeatStatus } from "../schemas/events.schemas";

const SEATS_PER_ROW = 10;

// available = neutral/open, held = accent orange (temporary — someone's mid-checkout), booked =
// primary navy (permanent). Read-only: no hold/purchase endpoint exists server-side yet, so seats
// aren't clickable.
const STATUS_STYLES: Record<SeatStatus, string> = {
  available: "text-muted-foreground",
  held: "text-accent",
  booked: "text-primary",
};

const STATUS_LABELS: Record<SeatStatus, string> = {
  available: "Available",
  held: "Held",
  booked: "Booked",
};

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

function SeatGrid({ seats }: { seats: SeatListItem[] }) {
  const rows = chunk(seats, SEATS_PER_ROW);

  return (
    <div>
      <svg
        viewBox="0 0 300 40"
        className="mx-auto mb-6 h-10 w-full max-w-xs text-accent"
        aria-hidden="true"
      >
        <path
          d="M10 35 Q150 -10 290 35"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex justify-center gap-2">
            {row.map((seat) => (
              <span
                key={seat.id}
                title={`Seat ${seat.label} — ${STATUS_LABELS[seat.status]}`}
                aria-label={`Seat ${seat.label}: ${STATUS_LABELS[seat.status]}`}
              >
                <Armchair aria-hidden="true" className={cn("size-6", STATUS_STYLES[seat.status])} />
              </span>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        {(Object.keys(STATUS_LABELS) as SeatStatus[]).map((status) => (
          <span key={status} className="flex items-center gap-1">
            <Armchair className={cn("size-4", STATUS_STYLES[status])} />
            {STATUS_LABELS[status]}
          </span>
        ))}
      </div>
    </div>
  );
}

export default SeatGrid;
