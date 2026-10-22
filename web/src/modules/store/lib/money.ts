/** Money in major units (14.5 → "$14.50"), the way the engine reports store prices. */
export function money(amount: number | null | undefined, currency = "USD"): string {
  const n = Number(amount ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n);
}
/** Always two decimals (totals, receipts). */
export function money2(amount: number | null | undefined, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(Number(amount ?? 0));
}
