// Currency itself isn't decided yet (project.md just scopes "single currency") — plain "$" prefix
// as a placeholder display, not an Intl currency-code commitment.
export function formatPriceCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}
