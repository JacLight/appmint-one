import type { Home, Unit } from "./types";

export const money = (n: number | null | undefined, currency = "USD") =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);

export const beds = (n: number) => (n === 0 ? "Studio" : `${n} bed${n === 1 ? "" : "s"}`);
export const baths = (n: number | null) => (n == null ? "" : `${n} bath${n === 1 ? "" : "s"}`);
export const sqft = (n: number | null) => (n == null ? "" : `${n.toLocaleString("en-US")} sq ft`);

const today = () => new Date().toISOString().slice(0, 10);
const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", opts);

/** "Available now" or "Available Nov 15". */
export const availability = (u: Pick<Unit, "availableFrom">) =>
  !u.availableFrom || u.availableFrom <= today() ? "Available now" : `Available ${fmtDay(u.availableFrom)}`;
export const isNow = (u: Pick<Unit, "availableFrom">) => !u.availableFrom || u.availableFrom <= today();

export const day = (iso?: string | null, opts?: Intl.DateTimeFormatOptions) => (iso ? fmtDay(iso, opts || { month: "short", day: "numeric", year: "numeric" }) : "");

export function rentRange(units: Unit[]): string {
  const r = units.map((u) => u.rent).filter((x): x is number => x != null);
  if (!r.length) return "Call for rent";
  const lo = Math.min(...r), hi = Math.max(...r);
  return lo === hi ? money(lo) : `${money(lo)} – ${money(hi)}`;
}

export function bedRange(units: Unit[]): string {
  if (!units.length) return "";
  const b = units.map((u) => u.beds);
  const lo = Math.min(...b), hi = Math.max(...b);
  if (units.every((u) => u.type === "room")) return units.length === 1 ? "1 room" : `${units.length} rooms`;
  return lo === hi ? beds(lo) : `${lo === 0 ? "Studio" : lo} – ${beds(hi)}`;
}

export const place = (h: Pick<Home, "address" | "neighborhood">) =>
  [h.address?.street1, h.neighborhood || h.address?.city].filter(Boolean).join(" · ");

export const fullAddress = (a: Home["address"]) =>
  [[a?.street1, a?.street2].filter(Boolean).join(" "), [a?.city, [a?.state, a?.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(", ");

export const terms = (t: number[]) =>
  t.length ? t.slice().sort((a, b) => a - b).map((m) => `${m}`).join(", ") + " months" : "12 months";

export const petsLabel = (p: Unit["pets"]) =>
  p === true ? "Pets welcome" : p === false ? "No pets" : typeof p === "string" && p ? p : "";

/* ───────────── commercial ───────────── */

/** "$28.50" — a per-square-foot rate keeps its cents. */
const rate = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n);
export const psf = (n: number | null | undefined) => (n == null ? "Call for rate" : `${rate(n)}/SF/yr`);
export const sf = (n: number | null | undefined) => (n == null ? "" : `${n.toLocaleString("en-US")} SF`);

export function psfRange(units: Unit[]): string {
  const r = units.map((u) => u.ratePsf).filter((x): x is number => x != null);
  if (!r.length) return "Call for rate";
  const lo = Math.min(...r), hi = Math.max(...r);
  return lo === hi ? rate(lo) : `${rate(lo)} – ${rate(hi)}`;
}

/** "1,200 – 8,400 SF", counting a divisible space down to its smallest piece. */
export function sfRange(units: Unit[]): string {
  const lo = Math.min(...units.map((u) => u.minSqft ?? u.sqft ?? Infinity));
  const hi = Math.max(...units.map((u) => u.sqft ?? 0));
  if (!Number.isFinite(lo) || !hi) return "";
  return lo === hi ? sf(hi) : `${lo.toLocaleString("en-US")} – ${sf(hi)}`;
}

/** One space's size, with how small it divides. */
export const unitSize = (u: Unit) => (u.minSqft && u.sqft && u.minSqft < u.sqft ? `${u.minSqft.toLocaleString("en-US")} – ${sf(u.sqft)}` : sf(u.sqft));

export const yearsTerms = (t: number[]) =>
  t.length ? t.slice().sort((a, b) => a - b).map((m) => (m % 12 ? `${m} mo` : `${m / 12} yr`)).join(", ") : "Negotiable";
