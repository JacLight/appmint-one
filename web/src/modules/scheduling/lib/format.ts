/** Formatting in the business's own time zone. Pure; safe on server and client. */

export function money(n: number, currency = "USD"): string {
  const v = Number(n) || 0;
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(v);
}

const fmt = (tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: tz, ...o });

/** "7:00 AM" */
export const time = (iso: string, tz: string) => fmt(tz, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
/** "7:00" + "AM" split, for the timetable's big time column. */
export function timeParts(iso: string, tz: string): [string, string] {
  const s = time(iso, tz);
  const i = s.lastIndexOf(" ");
  return i > 0 ? [s.slice(0, i), s.slice(i + 1)] : [s, ""];
}
/** "Tue, Oct 21" */
export const dayShort = (iso: string, tz: string) => fmt(tz, { weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));
/** "Tuesday, October 21" */
export const dayLong = (iso: string, tz: string) => fmt(tz, { weekday: "long", month: "long", day: "numeric" }).format(new Date(iso));
/** "Tue, Oct 21 · 7:00 AM" */
export const when = (iso: string, tz: string) => `${dayShort(iso, tz)} · ${time(iso, tz)}`;
/** "YYYY-MM-DD" of an instant in the zone. */
export function dayKey(iso: string | Date, tz: string): string {
  const p = fmt(tz, { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value || "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}
/** Today's "YYYY-MM-DD" in the zone. */
export const todayKey = (tz: string) => dayKey(new Date(), tz);
/** A "YYYY-MM-DD" plus n days. */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
/** Parts of a "YYYY-MM-DD" for the day strip: "Tue", "21", "Oct". */
export function keyParts(key: string): { wd: string; d: string; mon: string } {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 12));
  return {
    wd: t.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    d: String(d),
    mon: t.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
  };
}
export const keyLong = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
};
export const isKey = (v: any): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** "45 min", "1 hr", "1 hr 30 min" */
export function duration(min: number): string {
  if (!min) return "";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export const initials = (name?: string) => (name || "?").replace(/^(Dr\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
export const firstName = (name?: string) => (name || "").replace(/^(Dr\.?)\s+/i, "Dr. ").split(",")[0].trim();

/** "in 2 days", "tomorrow", "today" relative to the zone's today. */
export function relDay(iso: string, tz: string): string {
  const a = todayKey(tz), b = dayKey(iso, tz);
  if (a === b) return "Today";
  if (addDays(a, 1) === b) return "Tomorrow";
  return dayShort(iso, tz);
}

export const statusLabel = (s: string) => {
  const v = String(s || "").toLowerCase();
  return ({ new: "Booked", pending: "Requested", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled", canceled: "Cancelled", no_show: "Missed", rescheduled: "Rescheduled", used: "Attended" } as Record<string, string>)[v] || (v ? v[0].toUpperCase() + v.slice(1) : "");
};
