"use client";

import { hostCalendarAction } from "@/modules/rentals/actions/host";

import { useState, useEffect, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/alert";
import { routes } from "@/lib/nav";
import { addBlackoutAction, removeBlackoutAction } from "@/modules/rentals/actions/host";
import type { StowboCalendar, CalState, CalUpcoming, CapacityDay } from "@/api/rentals";

/* Month calendar for a space. The grid + occupancy + upcoming are computed on the
 * server (StowboService.getCalendar); this renders them as a real calendar with
 * reservation chips (→ the booking console), month nav, and a mobile agenda view. */

const STATE_COLOR: Record<CalState, string> = { free: "var(--muted)", booked: "var(--primary)", stored: "var(--accent)", overdue: "#c0392b", blocked: "#9a948440" };
const STATE_LABEL: Record<CalState, string> = { free: "Free", booked: "Booked", stored: "In custody", overdue: "Overdue", blocked: "Blocked" };
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monTitle = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const fullFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function toDate(s?: string) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s || ""); }
function guestShort(g?: string) { if (!g) return "Reserved"; const n = g.split("@")[0].replace(/[._]/g, " "); return n.charAt(0).toUpperCase() + n.slice(1); }

export function BookingCalendar({ id, initial }: { id: string; initial: StowboCalendar }) {
  const router = useRouter();
  const [cal, setCal] = useState<StowboCalendar>(initial);
  const [anchor, setAnchor] = useState<Date>(() => { const f = toDate(initial.from?.slice(0, 10)); return new Date(f.getFullYear(), f.getMonth(), 1); });
  const [view, setView] = useState<"month" | "list">("month");
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<number>(0);
  const [bFrom, setBFrom] = useState(""); const [bTo, setBTo] = useState(""); const [bReason, setBReason] = useState("servicing");
  const [showBlock, setShowBlock] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 760);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const effView: "month" | "list" = isMobile ? "list" : view;

  async function loadMonth(a: Date) {
    const first = new Date(a.getFullYear(), a.getMonth(), 1);
    const days = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate();
    setLoading(true); setErr(null);
    try {
      const r = await hostCalendarAction(id, ymd(first) + "T12:00:00", days);
      if (!r.ok) throw new Error(r.error);
      setCal(r.cal as any); setAnchor(first);
    } catch (e: any) { setErr(e?.message || "Couldn't load the calendar."); } finally { setLoading(false); }
  }
  const goMonth = (delta: number) => loadMonth(new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1));
  const goToday = () => { const n = new Date(); loadMonth(new Date(n.getFullYear(), n.getMonth(), 1)); };

  // per-day lookups
  const capByDay = useMemo(() => { const m: Record<string, CapacityDay> = {}; for (const d of cal.capacityByDay) m[d.date.slice(0, 10)] = d; return m; }, [cal]);
  const reservations = cal.upcoming || [];
  const resOn = (dayStart: Date) => { const de = new Date(dayStart); de.setDate(de.getDate() + 1); return reservations.filter((r) => toDate(r.startDate) < de && toDate(r.endDate) > dayStart); };
  const blockedOn = (key: string) => !!capByDay[key]?.blocked;

  // month grid cells
  const cells = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    const dim = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    const rows = Math.ceil((first.getDay() + dim) / 7);
    return Array.from({ length: rows * 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [anchor]);

  const todayKey = ymd(new Date());
  const inMonth = (d: Date) => d.getMonth() === anchor.getMonth();

  function block() {
    setErr(null); setOkMsg(null); setConflicts(0);
    start(async () => {
      const r = await addBlackoutAction(id, { from: bFrom, to: bTo, reason: bReason });
      if (r.ok) { setOkMsg("Those days are blocked — guests can't book them."); setBFrom(""); setBTo(""); setShowBlock(false); if (r.conflicts?.length) setConflicts(r.conflicts.length); await loadMonth(anchor); router.refresh(); }
      else setErr(r.error);
    });
  }
  function unblock(bid: string) { setErr(null); start(async () => { const r = await removeBlackoutAction(id, bid); if (r.ok) { await loadMonth(anchor); router.refresh(); } else setErr(r.error); }); }

  const ResChip = ({ r, compact }: { r: CalUpcoming; compact?: boolean }) => (
    <Link href={`/host/custody/${r.booking}`} title={`${guestShort(r.guest)} · ${STATE_LABEL[r.state]} · ${fullFmt.format(toDate(r.startDate))} → ${fullFmt.format(toDate(r.endDate))}${r.unit ? ` · unit ${r.unit}` : ""}`}
      style={{ display: "block", background: STATE_COLOR[r.state] || "var(--primary)", color: "#fff", borderRadius: 5, padding: compact ? "3px 8px" : "1px 6px", fontSize: compact ? 13 : 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.5 }}>
      {guestShort(r.guest)}{r.unit ? ` · ${r.unit}` : ""}{r.quantity && r.quantity > 1 ? ` ×${r.quantity}` : ""}
    </Link>
  );

  return (
    <div>
      <style>{`
        .cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
        .cal-dow{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin-bottom:6px}
        .cal-dow span{text-align:center;font-size:11px;font-weight:700;color:var(--muted);font-family:var(--font-display);letter-spacing:.03em}
        .cal-cell{min-height:104px;border:1px solid var(--border-2);border-radius:10px;padding:6px;background:var(--surface);display:flex;flex-direction:column;gap:3px;overflow:hidden}
        .cal-cell.out{background:var(--bg-2);opacity:.55}
        .cal-cell.blocked{background:repeating-linear-gradient(45deg,#efeadd,#efeadd 5px,#e6e0d0 5px,#e6e0d0 10px)}
        .cal-daynum{width:22px;height:22px;display:grid;place-items:center;font-size:12px;font-weight:700;font-family:var(--font-display);color:var(--text-2);border-radius:50%}
        .cal-cell.today .cal-daynum{background:var(--primary);color:#fff}
        @media(max-width:720px){ .cal-cell{min-height:82px} }
      `}</style>

      {err && <Alert kind="error" onDismiss={() => setErr(null)}>{err}</Alert>}
      {okMsg && <Alert kind="success" onDismiss={() => setOkMsg(null)}>{okMsg}</Alert>}
      {conflicts > 0 && <Alert kind="info" onDismiss={() => setConflicts(0)}>{conflicts} existing booking{conflicts > 1 ? "s" : ""} fall inside that window — they aren&apos;t cancelled; reach out to those guests.</Alert>}

      {/* summary — "today" reads the real current day when it's in the loaded window, not the window's first day */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
        {(() => { const t = capByDay[todayKey]; const inUse = t ? t.used : cal.today.inUse; const free = t ? t.free : cal.today.free; const blk = t ? t.blocked : cal.today.blocked; return (
          <>
            <div className="tcard"><p className="eyebrow">In use today</p><div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700 }}>{inUse}<span className="muted" style={{ fontSize: 14, fontWeight: 400 }}> / {cal.capacity}</span></div></div>
            <div className="tcard"><p className="eyebrow">Free today</p><div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: blk ? "var(--muted)" : "var(--accent-strong)" }}>{blk ? "Blocked" : free}</div></div>
          </>
        ); })()}
        <div className="tcard"><p className="eyebrow">Next free</p><div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, marginTop: 4 }}>{cal.nextFree ? fullFmt.format(new Date(cal.nextFree)) : "—"}</div></div>
        <div className="tcard"><p className="eyebrow">Next arrival</p><div style={{ fontFamily: "var(--font-display)", fontSize: 14.5, fontWeight: 700, marginTop: 4 }}>{cal.nextArrival ? fullFmt.format(new Date(cal.nextArrival.date)) : "None scheduled"}{cal.nextArrival?.guest ? <div className="muted" style={{ fontSize: 12, fontWeight: 400 }}>{guestShort(cal.nextArrival.guest)}</div> : null}</div></div>
      </div>

      {/* toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="btn ghost sm" disabled={loading} onClick={() => goMonth(-1)} aria-label="Previous month">‹</button>
          <b style={{ fontFamily: "var(--font-display)", fontSize: 18, minWidth: 150, textAlign: "center" }}>{monTitle.format(anchor)}</b>
          <button className="btn ghost sm" disabled={loading} onClick={() => goMonth(1)} aria-label="Next month">›</button>
          <button className="btn ghost sm" disabled={loading} onClick={goToday}>Today</button>
          {loading && <span className="muted" style={{ fontSize: 12 }}>loading…</span>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {!isMobile && (
            <div style={{ display: "inline-flex", background: "var(--bg-2)", borderRadius: 999, padding: 3 }}>
              {(["month", "list"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "6px 14px", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13, background: view === v ? "var(--text)" : "transparent", color: view === v ? "#fff" : "var(--text-2)" }}>{v === "month" ? "Month" : "List"}</button>
              ))}
            </div>
          )}
          <button className="btn clay sm" onClick={() => setShowBlock((s) => !s)}>Block days</button>
        </div>
      </div>

      {/* block form */}
      {showBlock && (
        <div className="tcard" style={{ marginBottom: 14, background: "var(--bg-2)" }}>
          <p className="hint" style={{ marginTop: 0 }}>Close this space for maintenance or a private hold — blocked days can&apos;t be booked.</p>
          <div className="frow" style={{ alignItems: "flex-end" }}>
            <div className="field"><label>From</label><input type="date" value={bFrom} onChange={(e) => setBFrom(e.target.value)} /></div>
            <div className="field"><label>To</label><input type="date" value={bTo} onChange={(e) => setBTo(e.target.value)} /></div>
            <div className="field"><label>Reason</label><select value={bReason} onChange={(e) => setBReason(e.target.value)}><option value="servicing">Servicing</option><option value="maintenance">Maintenance</option><option value="private">Private hold</option><option value="other">Other</option></select></div>
            <button className="btn clay" disabled={pending || !bFrom || !bTo} onClick={block} style={{ height: 44 }}>{pending ? "Blocking…" : "Block"}</button>
          </div>
          {cal.blackouts.length > 0 && (
            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              {cal.blackouts.map((b) => (
                <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "9px 12px", background: "var(--surface)", borderRadius: 10 }}>
                  <span style={{ fontSize: 13.5 }}><b style={{ fontFamily: "var(--font-display)" }}>{fullFmt.format(toDate(b.from))} → {fullFmt.format(toDate(b.to))}</b><span className="muted"> · {b.reason || "blocked"}</span></span>
                  <button className="btn ghost sm" disabled={pending} onClick={() => unblock(b.id)}>Re-open</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MONTH VIEW (desktop) / AGENDA LIST (mobile + list toggle) */}
      {effView === "month" ? (
        <div className="tcard" style={{ padding: 12 }}>
          <div className="cal-dow">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
          <div className="cal-grid">
            {cells.map((d, i) => {
              const key = ymd(d);
              const out = !inMonth(d);
              const blocked = blockedOn(key);
              const res = out ? [] : resOn(d);
              const cap = capByDay[key];
              return (
                <div key={i} className={`cal-cell${out ? " out" : ""}${blocked ? " blocked" : ""}${key === todayKey ? " today" : ""}`}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="cal-daynum">{d.getDate()}</span>
                    {!out && cap && !blocked && cap.used > 0 ? <span className="muted" style={{ fontSize: 10, fontWeight: 700 }}>{cap.free}/{cap.capacity}</span> : null}
                  </div>
                  {blocked && !out ? <span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>Blocked</span> : null}
                  {res.slice(0, 3).map((r, k) => <ResChip key={k} r={r} />)}
                  {res.length > 3 ? <span className="muted" style={{ fontSize: 10, fontWeight: 700 }}>+{res.length - 3} more</span> : null}
                </div>
              );
            })}
          </div>
          {/* legend */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
            {(["booked", "stored", "overdue"] as CalState[]).map((s) => <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: STATE_COLOR[s] }} />{STATE_LABEL[s]}</span>)}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "repeating-linear-gradient(45deg,#e6e0d0,#e6e0d0 3px,#efeadd 3px,#efeadd 6px)" }} />Blocked</span>
          </div>
        </div>
      ) : (
        /* LIST / AGENDA VIEW */
        <div style={{ display: "grid", gap: 10 }}>
          {reservations.length === 0 && cal.blackouts.length === 0 ? (
            <div className="tcard"><p className="muted" style={{ margin: 0 }}>No reservations or blocks this month.</p></div>
          ) : (
            <>
              {[...reservations].sort((a, b) => String(a.startDate).localeCompare(String(b.startDate))).map((r, i) => (
                <Link key={i} href={`/host/custody/${r.booking}`} className="tcard" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: STATE_COLOR[r.state], flex: "none" }} />
                    <div style={{ minWidth: 0 }}>
                      <b style={{ fontFamily: "var(--font-display)" }}>{guestShort(r.guest)}</b>
                      <div className="muted" style={{ fontSize: 13 }}>{dayFmt.format(toDate(r.startDate))} → {dayFmt.format(toDate(r.endDate))}{r.unit ? ` · unit ${r.unit}` : ""}{r.quantity && r.quantity > 1 ? ` · ×${r.quantity}` : ""}</div>
                    </div>
                  </div>
                  <span className="fpill" style={{ fontSize: 11, background: STATE_COLOR[r.state], color: "#fff", border: 0 }}>{STATE_LABEL[r.state]}</span>
                </Link>
              ))}
              {cal.blackouts.map((b) => (
                <div key={b.id} className="tcard" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "var(--bg-2)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#9a9484", flex: "none" }} />
                    <div><b style={{ fontFamily: "var(--font-display)" }}>Blocked · {b.reason || "servicing"}</b><div className="muted" style={{ fontSize: 13 }}>{dayFmt.format(toDate(b.from))} → {dayFmt.format(toDate(b.to))}</div></div>
                  </div>
                  <button className="btn ghost sm" disabled={pending} onClick={() => unblock(b.id)}>Re-open</button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
