/**
 * Client-safe types and display helpers for the setup-driven marketplace screens
 * (stays, gear). No money is computed here: every amount comes from the server's
 * quote/booking and is only formatted.
 */
import type { RentalsConfig, RentalUnit } from "@/setups/rentals-config";

export interface Rating { average: number | null; count: number }
export interface QuoteFeeRow { label: string; amount: number; by?: string; code?: string }
export interface MarketQuote {
  total: number; subtotal: number; tax?: number; currency?: string;
  rateLabel?: string; rateMinutes?: number; base?: number;
  fees: QuoteFeeRow[]; discount?: number;
  freeUntil?: string | null; policy?: string | null;
  bookable?: boolean; reason?: string | null;
}

/** One stay/item as the cards, map and list need it. */
export interface MarketCard {
  id: string;
  title: string;
  type: string;
  typeLabel: string;
  city: string;
  state: string;
  image: string | null;
  images: string[];
  price: number | null;     // the posted nightly/daily rate (what the host charges per unit)
  unit: string;             // "night" | "day" | "hour"
  facts: string[];          // ["6 guests", "2 bedrooms", ...]
  rating: Rating;
  lat: number | null;
  lng: number | null;
  /** with dates: the server's total for the stay */
  total?: number | null;
  /** with dates: number of nights/days/hours the total covers */
  span?: string | null;
  badge?: string | null;
}

export function money(v: number | null | undefined, currency = "USD", cents = false): string {
  const n = Number(v ?? 0);
  const whole = !cents && Math.abs(n % 1) < 0.005;
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: whole ? 0 : 2, minimumFractionDigits: whole ? 0 : 2 }).format(n);
}

export function unitWord(unit: string): string {
  return unit === "day" ? "day" : unit === "hour" ? "hour" : unit === "week" ? "week" : unit === "month" ? "month" : "night";
}

/** The listing's unit as the setup reads it: a stays "day" band is a night. */
export function unitFor(cfg: Pick<RentalsConfig, "unit">, priceUnit?: string): RentalUnit {
  if (priceUnit === "hour") return "hour";
  if (cfg.unit === "night") return "night";
  return (priceUnit as RentalUnit) || cfg.unit;
}

export function plural(n: number, one: string, many: string): string {
  return `${n % 1 === 0 ? n : n.toFixed(1)} ${n === 1 ? one : many}`;
}

/** "3 nights" / "2 days" / "4 hours" from a span in minutes (how the server billed it). */
export function spanLabel(minutes: number | undefined, unit: string): string | null {
  if (!minutes || minutes <= 0) return null;
  if (unit === "hour") { const h = Math.ceil(minutes / 60); return plural(h, "hour", "hours"); }
  const d = Math.ceil(minutes / 1440);
  return unit === "night" ? plural(d, "night", "nights") : plural(d, "day", "days");
}

/** Headline facts from `details` per the setup: counts read "6 guests", text reads as-is. */
export function factsOf(cfg: Pick<RentalsConfig, "facts">, details: Record<string, any> | undefined): string[] {
  const d = details || {};
  return cfg.facts
    .map((f) => {
      const v = d[f.key];
      if (v == null || v === "") return null;
      if (typeof v === "number") return f.one ? plural(v, f.one, f.many) : String(v);
      return String(v);
    })
    .filter((x): x is string => !!x);
}

export function stars(avg: number | null | undefined): string {
  if (avg == null) return "New";
  const two = avg.toFixed(2);
  return two.endsWith("0") ? avg.toFixed(1) : two;
}

/** "Nov 13 – 16" / "Nov 28 – Dec 2" — date-only strings (YYYY-MM-DD), no timezone drift. */
export function rangeLabel(from?: string, to?: string): string {
  if (!from) return "";
  const a = ymd(from), b = to ? ymd(to) : null;
  const m = (d: Date) => d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  if (!b) return `${m(a)} ${a.getUTCDate()}`;
  if (a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear()) return `${m(a)} ${a.getUTCDate()} – ${b.getUTCDate()}`;
  return `${m(a)} ${a.getUTCDate()} – ${m(b)} ${b.getUTCDate()}`;
}

export function ymd(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDays(s: string, n: number): string {
  const d = ymd(s);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
}
export function nightsBetween(a?: string, b?: string): number {
  if (!a || !b) return 0;
  return Math.round((ymd(b).getTime() - ymd(a).getTime()) / 86_400_000);
}

/** "4:00 PM" → minutes after midnight. */
export function clockMinutes(label: string | undefined, fallback: number): number {
  const m = String(label || "").match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!m) return fallback;
  let h = Number(m[1]) % 12;
  if (/pm/i.test(m[3] || "")) h += 12;
  if (!m[3] && Number(m[1]) >= 12) h = Number(m[1]);
  return h * 60 + Number(m[2] || 0);
}

/**
 * The engine window for a stay. Check-in and check-out are the house's clock times,
 * stored at that wall-clock value (UTC-tagged) so every screen reads back the same day
 * and time the host advertises. Check-out before check-in → the engine bills nights.
 */
export function stayWindow(from: string, to: string, checkIn?: string, checkOut?: string) {
  const ci = clockMinutes(checkIn, 16 * 60), co = clockMinutes(checkOut, 10 * 60);
  const at = (day: string, mins: number) => `${day}T${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}:00.000Z`;
  return { startDate: at(from, ci), endDate: at(to, co) };
}
/** Hourly window on one day. */
export function hourWindow(day: string, startMins: number, hours: number) {
  const s = new Date(`${day}T00:00:00.000Z`);
  s.setUTCMinutes(startMins);
  const e = new Date(s.getTime() + hours * 3_600_000);
  return { startDate: s.toISOString(), endDate: e.toISOString() };
}

/** Wall-clock display of a stored stay instant ("Fri, Nov 13" / "4:00 PM"). */
export function dayLabel(iso?: string | null, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}
export function timeLabel(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

export function firstName(name?: string | null): string {
  return String(name || "").trim().split(/\s+/)[0] || "";
}
export function initials(name?: string | null): string {
  return String(name || "?").split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/** What a reservation asks for — the same params travel listing → book → server. */
export interface WhenParams { from?: string | null; to?: string | null; date?: string | null; start?: number | null; hours?: number | null }

/** The engine window for a listing's unit. Stays use the house's check-in/out clock; a
 *  daily rental runs pick-up 10:00 to return 10:00; an hourly space a start + hours. */
export function windowFor(unit: string, w: WhenParams, details?: Record<string, any>): { startDate: string; endDate: string } | null {
  if (unit === "hour") {
    if (!w.date || w.start == null || !w.hours) return null;
    return hourWindow(w.date, w.start, w.hours);
  }
  if (!w.from || !w.to || w.to <= w.from) return null;
  if (unit === "night") return stayWindow(w.from, w.to, details?.checkIn, details?.checkOut);
  return { startDate: `${w.from}T10:00:00.000Z`, endDate: `${w.to}T10:00:00.000Z` };
}

export function whenQuery(w: WhenParams, g?: { adults: number; children: number; infants: number; pets: number }): string {
  const p = new URLSearchParams();
  if (w.from) p.set("from", w.from);
  if (w.to) p.set("to", w.to);
  if (w.date) p.set("date", w.date);
  if (w.start != null) p.set("start", String(w.start));
  if (w.hours) p.set("hours", String(w.hours));
  if (g) for (const k of ["adults", "children", "infants", "pets"] as const) if (g[k]) p.set(k, String(g[k]));
  return p.toString();
}

export function clockLabel(mins: number): string {
  const h = Math.floor(mins / 60) % 24, m = mins % 60;
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

export const POLICY_TEXT: Record<string, string> = {
  flexible: "Cancel any time before check-in for a full refund.",
  moderate: "Cancel at least 24 hours before check-in for a full refund.",
  strict: "Cancel at least 48 hours before check-in for a full refund. After that, half of what you paid is refunded.",
};
/** Policy text in the setup's words: "before check-in" for stays, "before pick up" for gear. */
export function policyText(policy: string | undefined, start = "Check-in"): string {
  return (POLICY_TEXT[policy || ""] || POLICY_TEXT.moderate).replace("check-in", start.toLowerCase());
}

