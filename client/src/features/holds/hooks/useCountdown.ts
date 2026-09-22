import { useEffect, useState } from "react";

function msRemaining(expiresAt: string): number {
  return new Date(expiresAt).getTime() - Date.now();
}

/** Live "M:SS" countdown to `expiresAt`, ticking every second until it reaches zero. */
export function useCountdown(expiresAt: string) {
  const [state, setState] = useState(() => ({ expiresAt, remaining: msRemaining(expiresAt) }));

  // Adjusting state during render when a prop changes (a new hold) — React's documented pattern
  // for this, bailing out before paint; no ref, no effect needed for the "reset" half.
  if (state.expiresAt !== expiresAt) {
    setState({ expiresAt, remaining: msRemaining(expiresAt) });
  }

  // The interval is the actual external-system synchronization (the wall clock) an effect is for.
  useEffect(() => {
    const interval = setInterval(() => {
      setState((prev) => ({ ...prev, remaining: msRemaining(expiresAt) }));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const totalSeconds = Math.max(0, Math.floor(state.remaining / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return {
    isExpired: state.remaining <= 0,
    label: `${minutes}:${String(seconds).padStart(2, "0")}`,
  };
}
