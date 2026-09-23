// Currency itself isn't decided yet (project.md just scopes "single currency") — plain "$" prefix
// as a placeholder display, not an Intl currency-code commitment.
export function formatPriceCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

// For a compact date badge (month + day), the format ticketing UIs use — e.g. an events list row.
export function formatDateBadge(iso: string): { month: string; day: string } {
  const date = new Date(iso);
  return {
    month: date.toLocaleDateString(undefined, { month: "short" }),
    day: date.toLocaleDateString(undefined, { day: "numeric" }),
  };
}
