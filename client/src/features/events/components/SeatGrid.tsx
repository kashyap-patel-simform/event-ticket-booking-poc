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
  /** Once selectedSeatIds reaches this size, unselected seats become unclickable (selected ones stay toggleable so the user can still deselect). */
  maxSelectable?: number;
}

function SeatGrid({
  seats,
  selectedSeatIds,
  onToggleSeat,
  disabled = false,
  maxSelectable,
}: SeatGridProps) {
  const rows = chunk(seats, SEATS_PER_ROW);
  const selectionLimitReached =
    maxSelectable !== undefined && selectedSeatIds.size >= maxSelectable;

  return (
    <div>
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
                    className="flex flex-col items-center gap-0.5"
                  >
                    {icon}
                    <span className={cn("text-[10px] leading-none", STATUS_STYLES[seat.status])}>
                      {seat.label}
                    </span>
                  </span>
                );
              }

              return (
                <button
                  key={seat.id}
                  type="button"
                  disabled={disabled || (selectionLimitReached && !isSelected)}
                  aria-pressed={isSelected}
                  title={`Seat ${seat.label} — ${label}`}
                  aria-label={`Seat ${seat.label}: ${label}`}
                  onClick={() => onToggleSeat(seat.id)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-md p-0.5 disabled:cursor-not-allowed disabled:opacity-60",
                    isSelected && "bg-accent/10 ring-1 ring-accent",
                  )}
                >
                  {icon}
                  <span
                    className={cn(
                      "text-[10px] leading-none",
                      isSelected ? "text-accent" : STATUS_STYLES[seat.status],
                    )}
                  >
                    {seat.label}
                  </span>
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
