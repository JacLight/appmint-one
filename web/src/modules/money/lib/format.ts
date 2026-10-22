/** Display helpers for the Money module. Client- and server-safe. No money maths:
 *  amounts are formatted exactly as the API returned them. */
import type { Money, TxCategory, TxKind, Transaction, AccountType } from "../api/types";

export function fmt(m: Money | number | null | undefined, opts: { sign?: "credit" | "debit" | "auto"; currency?: string } = {}): string {
  const cents = typeof m === "number" ? m : m?.amount ?? 0;
  const currency = (typeof m === "object" && m?.currency) || opts.currency || "USD";
  const s = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Math.abs(cents) / 100);
  if (opts.sign === "credit") return `+${s}`;
  if (opts.sign === "debit") return `−${s}`;
  return cents < 0 ? `−${s}` : s;
}

/** "$4,280" and ".16" for big balances with small cents. */
export function splitMoney(m: Money | number): { whole: string; cents: string } {
  const s = fmt(m);
  const i = s.lastIndexOf(".");
  return i < 0 ? { whole: s, cents: "" } : { whole: s.slice(0, i), cents: s.slice(i) };
}

/** Compact "$12.1K" for chart labels. */
export function fmtCompact(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);
}

export const mask = (last4: string) => `••${last4}`;

/** "Everyday Checking ••4021" */
export const accountLabel = (a: { name: string; nickname?: string; mask: string }) => `${a.nickname || a.name} ${mask(a.mask)}`;

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = { checking: "Checking", savings: "Savings" };

/** ABA routing checksum (3-7-1). The bank re-checks it; this only helps typing. */
export function isValidRouting(rn: string): boolean {
  if (!/^\d{9}$/.test(rn)) return false;
  const d = rn.split("").map(Number);
  return (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10 === 0;
}

/** Parse what someone typed ("1,250.5") into cents. Returns null when it isn't an amount. */
export function parseAmount(input: string): number | null {
  const s = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [w, f = ""] = s.split(".");
  return Number(w) * 100 + Number((f + "00").slice(0, 2));
}

export const CATEGORY_LABEL: Record<TxCategory, string> = {
  income: "Income", transfers: "Transfers", groceries: "Groceries", dining: "Dining", shopping: "Shopping", transport: "Transport",
  bills: "Bills & utilities", housing: "Housing", health: "Health & fitness", entertainment: "Entertainment", travel: "Travel",
  cash: "Cash", fees: "Fees", interest: "Interest", other: "Other",
};

export const KIND_LABEL: Record<TxKind, string> = {
  card: "Card purchase", atm: "ATM", ach: "Bank transfer", internal: "Tidewell transfer", own: "Between your accounts", wire: "Wire",
  deposit: "Direct deposit", interest: "Interest", fee: "Fee", refund: "Refund",
};

/** Avatar tint per category (soft, on-brand). */
export const CATEGORY_TINT: Record<TxCategory, string> = {
  income: "#dff3e7", transfers: "#e3ecf7", groceries: "#e8f4dc", dining: "#fbe9dc", shopping: "#efe6f8", transport: "#e2eef0",
  bills: "#f3ecda", housing: "#e9e6f3", health: "#fde4e7", entertainment: "#f6e1ef", travel: "#dff0f7", cash: "#ecefe5",
  fees: "#f1e3e1", interest: "#dff3e7", other: "#eceff1",
};

export function initials(name: string): string {
  const parts = name.replace(/[^A-Za-z0-9 &]/g, " ").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "•";
}

export function txTitle(t: Transaction): string {
  if (t.kind === "internal" || t.kind === "ach") return t.direction === "credit" ? `From ${t.counterparty?.name || t.description}` : `To ${t.counterparty?.name || t.description}`;
  return t.description;
}

const TZ = "America/Chicago";
export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts }).format(d);
}
export function fmtDateTime(iso: string): string {
  return fmtDate(iso, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
export function fmtTime(iso: string): string {
  return fmtDate(iso, { hour: "numeric", minute: "2-digit" });
}
/** Local calendar day key for grouping. */
export function dayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
export function dayHeading(key: string, now = new Date()): string {
  const today = dayKey(now.toISOString());
  const y = new Date(now.getTime() - 864e5);
  if (key === today) return "Today";
  if (key === dayKey(y.toISOString())) return "Yesterday";
  const d = new Date(`${key}T12:00:00Z`);
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) }).format(d);
}
export function periodLabel(period: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${period}-15T12:00:00Z`));
}
export function greeting(now = new Date()): string {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(now));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
