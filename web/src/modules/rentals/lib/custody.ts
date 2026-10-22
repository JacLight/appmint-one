import type { TimelineEvent } from "@/api/rentals";
import { parseDate, fmtFull } from "@/lib/dates";

/* ── the custody stage (for the status stepper) ──
 * A booking moves Booked → In custody → Collected. "In custody" opens at
 * check-in (checkedInAt on any item); "Collected" is reached at check-out
 * (all items ended / booking completed|settled). Cancelled is off to the side. */
export type Stage = { index: number; cancelled: boolean; steps: { key: string; label: string; at?: string }[] };

export function bookingStage(status: string, items: any[]): Stage {
  const cancelled = status === "cancelled";
  const checkedInAt = items.map((i) => i.checkedInAt).filter(Boolean).sort()[0];
  const checkedOutAts = items.map((i) => i.checkedOutAt).filter(Boolean).sort();
  const checkedOutAt = checkedOutAts[checkedOutAts.length - 1];

  let index = 0;
  const allEnded = items.length > 0 && items.every((item) => item.checkedOutAt || item.status === "ended" || item.status === "cancelled");
  if (["settled", "completed"].includes(status) || allEnded) index = 2;
  else if (["active", "in_custody"].includes(status) || checkedInAt) index = 1;

  return {
    index,
    cancelled,
    steps: [
      { key: "booked", label: "Booked" },
      { key: "in", label: "In custody", at: checkedInAt || undefined },
      { key: "out", label: "Collected", at: checkedOutAt || undefined },
    ],
  };
}

/* ── humanize one activity event ── */
const REL = (iso?: string): string => {
  const d = parseDate(iso);
  if (!d) return "";
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / 86400);
  if (days < 7) return `${days}d ago`;
  return fmtFull(iso);
};

/** Strip a trailing item-id token (e.g. "Checked out h02s2m8n" → "Checked out"). */
const clean = (s?: string) => (s || "").replace(/\s*[—-]?\s*[a-z0-9]*\d[a-z0-9]{4,}$/i, "").trim();

export function eventLabel(ev: TimelineEvent): { title: string; icon: string; tone: "in" | "out" | "money" | "warn" | "info" } {
  const dir = (ev as any).direction as string | undefined;
  switch (ev.type) {
    case "booked": return { title: "Booking confirmed", icon: "✓", tone: "info" };
    case "access": {
      // Direction isn't a top-level field — it's the head of the detail ("Out — …").
      const out = dir === "out" || /^\s*out\b/i.test(ev.detail || "");
      return out
        ? { title: "Moved out", icon: "↑", tone: "out" }
        : { title: "Moved in", icon: "↓", tone: "in" };
    }
    case "note": return { title: clean(ev.detail) || "Note added", icon: "•", tone: "info" };
    case "request": return { title: clean(ev.detail) || "Guest made a request", icon: "⚡", tone: "warn" };
    case "request_update": return { title: clean(ev.detail) || "Request updated", icon: "→", tone: "info" };
    case "extended": return { title: ev.detail || "Stay extended", icon: "＋", tone: "info" };
    case "unit_changed": return { title: ev.detail || "Moved to a different unit", icon: "⇄", tone: "info" };
    case "adjustment": return { title: ev.detail || "Bill adjusted", icon: "$", tone: "money" };
    case "settled": return { title: "Settled", icon: "$", tone: "money" };
    case "paid_out": return { title: "Host paid out", icon: "$", tone: "money" };
    case "cancelled": return { title: ev.detail || "Cancelled", icon: "✕", tone: "warn" };
    default: return { title: ev.detail || ev.type, icon: "•", tone: "info" };
  }
}

export const eventWhen = REL;
export function actorWord(ev: TimelineEvent): string {
  const r = (ev.actorRole || "").toLowerCase();
  if (r === "guest") return "You";
  if (r === "host") return "Host";
  if (r === "operator") return "Staff";
  if (r === "system") return "Stowbo";
  return "";
}
