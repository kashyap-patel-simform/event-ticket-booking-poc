import { Armchair } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SeatListItem, SeatStatus } from "../schemas/events.schemas";

const SEATS_PER_ROW = 10;

// available = neutral/open, held = accent orange (temporary — someone's mid-checkout), booked =
// primary navy (permanent). A selected-but-not-yet-held seat also uses the accent hue (still
// means "spoken for"), differentiated from `held` by the ring/background wrapper added below,
// since it's client-only UI state, not a real SeatStatus.
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

interface SeatGridProps {
  seats: SeatListItem[];
  selectedSeatIds: Set<string>;
  onToggleSeat: (seatId: string) => void;
  /** Disables selecting further seats — e.g. while a hold from a previous selection is active. */
  disabled?: boolean;
}

function SeatGrid({ seats, selectedSeatIds, onToggleSeat, disabled = false }: SeatGridProps) {
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
            {row.map((seat) => {
              const isSelected = selectedSeatIds.has(seat.id);
              const label = isSelected ? "Selected" : STATUS_LABELS[seat.status];
              const icon = (
                <Armchair
                  aria-hidden="true"
                  className={cn("size-6", isSelected ? "text-accent" : STATUS_STYLES[seat.status])}
                />
              );

              if (seat.status !== "available") {
                return (
                  <span
                    key={seat.id}
                    title={`Seat ${seat.label} — ${STATUS_LABELS[seat.status]}`}
                    aria-label={`Seat ${seat.label}: ${STATUS_LABELS[seat.status]}`}
                  >
                    {icon}
                  </span>
                );
              }

              return (
                <button
                  key={seat.id}
                  type="button"
                  disabled={disabled}
                  aria-pressed={isSelected}
                  title={`Seat ${seat.label} — ${label}`}
                  aria-label={`Seat ${seat.label}: ${label}`}
                  onClick={() => onToggleSeat(seat.id)}
                  className={cn(
                    "rounded-md p-0.5 disabled:cursor-not-allowed disabled:opacity-60",
                    isSelected && "bg-accent/10 ring-1 ring-accent",
                  )}
                >
                  {icon}
                </button>
              );
            })}
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
