/** Shared, human date formatting for bookings & checkout — spelled out, never a
 *  bare "2026-08-27T20:00 → …". Noon-only values are treated as date-only (the
 *  app stores all-day storage windows at T12:00). */
export const parseDate = (v?: string): Date | null => {
  if (!v) return null;
  const d = new Date(v.includes("T") ? v : `${v}T12:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};
export const hasClock = (v?: string): boolean => !!v && v.includes("T") && !/T12:00(:00)?$/.test(v);

/** "Wed, Aug 27, 2026" — plus "· 8:00 PM" when the booking is time-of-day. */
export const fmtFull = (v?: string): string => {
  const d = parseDate(v);
  if (!d) return "—";
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  return hasClock(v) ? `${day} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : day;
};

/** "Aug 27, 2026" — for a booked-on / short stamp. */
export const fmtDate = (v?: string): string => {
  const d = parseDate(v);
  return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
};

/** Human span between two instants: "31 days", "3 hours", "45 min". */
export const duration = (a?: string, b?: string): string => {
  const s = parseDate(a), e = parseDate(b);
  if (!s || !e) return "";
  const ms = e.getTime() - s.getTime();
  if (ms <= 0) return "";
  const mins = Math.round(ms / 60000), hrs = Math.round(ms / 3.6e6), days = Math.round(ms / 8.64e7), wks = Math.round(days / 7), mos = Math.round(days / 30);
  if (mins < 60) return `${mins} min`;
  if (hrs < 24) return `${hrs} ${hrs === 1 ? "hour" : "hours"}`;
  if (days < 14) return `${days} ${days === 1 ? "day" : "days"}`;
  if (days < 60) return `${wks} ${wks === 1 ? "week" : "weeks"}`;
  return `${mos} ${mos === 1 ? "month" : "months"}`;
};
