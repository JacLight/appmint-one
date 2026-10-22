"use client";

import Link from "next/link";
import type { CustodyLine } from "@/api/rentals";

/* ── date helpers (guard empty / invalid) ── */
const shortFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
function d(v?: string) {
  if (!v) return null;
  const t = new Date(v);
  return isNaN(t.getTime()) ? null : t;
}
function range(a?: string, b?: string) {
  const s = d(a), e = d(b);
  if (!s && !e) return "";
  if (s && e) return `${shortFmt.format(s)} – ${shortFmt.format(e)}`;
  return shortFmt.format((s || e)!);
}

const STATE: Record<string, { label: string; bg: string; fg: string; dot: string }> = {
  booked: { label: "Awaiting drop-off", bg: "var(--primary-soft)", fg: "var(--primary-strong)", dot: "var(--primary)" },
  stored: { label: "In your care", bg: "var(--accent-soft)", fg: "var(--accent-strong)", dot: "var(--accent)" },
  retrieved: { label: "Handed back", bg: "var(--border-2)", fg: "var(--text-2)", dot: "var(--muted)" },
  damaged: { label: "Damaged", bg: "#fbe9e2", fg: "#a5401f", dot: "#cf4a2c" },
  lost: { label: "Lost", bg: "#fbe9e2", fg: "#a5401f", dot: "#cf4a2c" },
  abandoned: { label: "Abandoned", bg: "#fbe9e2", fg: "#a5401f", dot: "#cf4a2c" },
};

function Badge({ state }: { state: string }) {
  const s = STATE[state] || { label: state, bg: "var(--border-2)", fg: "var(--text-2)", dot: "var(--muted)" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: s.bg, color: s.fg, borderRadius: 999, padding: "5px 12px", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 12.5, whiteSpace: "nowrap" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot }} />{s.label}
    </span>
  );
}

function overdueOf(line: CustodyLine) {
  return Boolean(line.overdueSince || line.overdueMs);
}

export function CustodyList({ lines }: { lines: CustodyLine[] }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p className="hint" style={{ marginTop: 0 }}>
        Every hand-over is code-verified: the guest gives you their <b>drop-off code</b> to leave an item, and their <b>pickup code</b> to take it back. Open any item to manage it, message the guest, and settle.
      </p>
      {lines.map((line, i) => (
        <Link
          key={`${line.booking}-${line.index}-${i}`}
          href={`/host/custody/${line.booking}`}
          className="tcard"
          style={{ display: "flex", alignItems: "center", gap: 16, textDecoration: "none", color: "inherit" }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>{line.listingTitle || line.listing}</b>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
              {line.unit ? `Unit ${line.unit} · ` : ""}Qty {line.quantity}
              {range(line.startDate, line.endDate) ? ` · ${range(line.startDate, line.endDate)}` : ""}
            </div>
          </div>
          {overdueOf(line) && (
            <span style={{ fontSize: 11, color: "#a5401f", background: "#fbe9e2", border: "1px solid #e7b39c", borderRadius: 999, padding: "4px 10px", fontFamily: "var(--font-display)", fontWeight: 600 }}>Overdue</span>
          )}
          <Badge state={line.state} />
          <span aria-hidden style={{ color: "var(--faint)", fontSize: 18 }}>›</span>
        </Link>
      ))}
    </div>
  );
}
