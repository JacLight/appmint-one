"use client";

import { useState, useRef, useEffect, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/alert";
import { routes } from "@/lib/nav";
import { formatMoney } from "@/lib/utils";
import {
  dropoffAction, retrieveAction, settleAction,
  chargeGuestAction, refundGuestAction, reverseAdjustmentAction,
  holdPaymentAction, releasePaymentAction, cancelBookingAction, openClaimAction,
} from "@/modules/rentals/actions/host";
import { sendMessageAction } from "@/app/actions/community";
import type { Envelope } from "@/lib/api";
import type { StowboBooking, BookingTimeline, Adjustment, TimelineEvent } from "@/api/rentals";
import type { CommunityMessage } from "@/lib/community";

/* ── helpers ── */
function parse(v?: string) { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
const dFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const dtFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const tFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
function fd(v?: string) { const d = parse(v); return d ? dFmt.format(d) : "—"; }
function fdt(v?: string) { const d = parse(v); return d ? dtFmt.format(d) : ""; }
function money(v?: number, cur = "USD") { return formatMoney(Number(v ?? 0) * 100, cur); }

/* signed value of an adjustment: charges add, everything else subtracts */
function signed(a: Adjustment) { return a.kind === "charge" ? Number(a.amount) : -Number(a.amount); }

const STATUS_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  requested: { bg: "var(--border-2)", fg: "var(--muted)", label: "Requested" },
  confirmed: { bg: "var(--primary-soft)", fg: "var(--primary-strong)", label: "Confirmed" },
  in_custody: { bg: "var(--primary-soft)", fg: "var(--primary-strong)", label: "In custody" },
  retrieved: { bg: "var(--accent-soft)", fg: "var(--accent-strong)", label: "Retrieved" },
  settled: { bg: "var(--accent-soft)", fg: "var(--accent-strong)", label: "Settled" },
  cancelled: { bg: "#fbe9e2", fg: "#a5401f", label: "Cancelled" },
  disputed: { bg: "#fbe9e2", fg: "#a5401f", label: "Disputed" },
  no_show: { bg: "#fbe9e2", fg: "#a5401f", label: "No-show" },
};
function Pill({ status }: { status?: string }) {
  const s = STATUS_PILL[status || ""] || { bg: "var(--border-2)", fg: "var(--muted)", label: status || "—" };
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11.5, letterSpacing: ".03em", textTransform: "uppercase", color: s.fg, background: s.bg, borderRadius: 999, padding: "3px 11px" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: s.fg }} />{s.label}</span>;
}

const STAGES = [
  { key: "requested", label: "Requested" },
  { key: "confirmed", label: "Confirmed" },
  { key: "in_custody", label: "In custody" },
  { key: "retrieved", label: "Retrieved" },
  { key: "settled", label: "Settled" },
];
function StagePipeline({ status }: { status?: string }) {
  const ended = status === "cancelled" || status === "no_show" || status === "disputed";
  const idx = STAGES.findIndex((s) => s.key === status);
  const active = idx < 0 ? 0 : idx;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", padding: "4px 0" }}>
      {STAGES.map((s, i) => {
        const done = !ended && i <= active;
        const cur = !ended && i === active;
        return (
          <div key={s.key} style={{ display: "flex", alignItems: "center", flex: i < STAGES.length - 1 ? 1 : "none", minWidth: "fit-content" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, color: done ? "#fff" : "var(--muted)", background: done ? (cur ? "var(--primary)" : "var(--accent)") : "var(--border-2)", border: cur ? "2px solid var(--primary)" : "none" }}>{done && !cur ? "✓" : i + 1}</span>
              <span style={{ fontSize: 11, fontFamily: "var(--font-display)", fontWeight: 600, color: cur ? "var(--text)" : "var(--muted)", whiteSpace: "nowrap" }}>{s.label}</span>
            </div>
            {i < STAGES.length - 1 && <div style={{ flex: 1, height: 2, background: !ended && i < active ? "var(--accent)" : "var(--border)", margin: "0 6px", alignSelf: "flex-start", marginTop: 10, minWidth: 24 }} />}
          </div>
        );
      })}
      {ended && <span style={{ marginLeft: 14 }}><Pill status={status} /></span>}
    </div>
  );
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return <span style={{ width: size, height: size, flex: "none", borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: size * 0.42 }}>{(name || "?").charAt(0).toUpperCase()}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="eyebrow" style={{ fontSize: 10.5 }}>{label}</div><div style={{ fontSize: 13.5, marginTop: 2 }}>{children}</div></div>;
}

/* ── activity feed ── */
const EVENT_ICON: Record<string, string> = { booked: "🗓️", created: "🗓️", dropoff: "📥", dropped_off: "📥", retrieve: "📤", retrieved: "📤", settle: "💰", settled: "💰", adjustment: "±", claim_opened: "⚠️", claim: "⚠️", cancelled: "✕", hold: "⏸️", release: "▶️", message: "💬" };
function roleBadge(role?: string) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    host: { bg: "var(--primary-soft)", fg: "var(--primary-strong)", label: "Host" },
    guest: { bg: "var(--accent-soft)", fg: "var(--accent-strong)", label: "Guest" },
    operator: { bg: "var(--border-2)", fg: "var(--muted)", label: "System" },
    system: { bg: "var(--border-2)", fg: "var(--muted)", label: "System" },
  };
  const r = map[role || ""] || map.operator;
  return <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "var(--font-display)", color: r.fg, background: r.bg, borderRadius: 5, padding: "1px 6px" }}>{r.label}</span>;
}
function ActivityFeed({ events, cur }: { events: TimelineEvent[]; cur: string }) {
  if (!events.length) return <p className="muted" style={{ fontSize: 13, margin: 0 }}>No activity yet.</p>;
  return (
    <div style={{ display: "grid", gap: 0 }}>
      {events.map((e, i) => (
        <div key={e.id || i} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: i < events.length - 1 ? "1px solid var(--border-2)" : "none" }}>
          <span style={{ flex: "none", width: 24, height: 24, borderRadius: "50%", background: "var(--bg-2)", display: "grid", placeItems: "center", fontSize: 12 }}>{EVENT_ICON[e.type] || "•"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <b style={{ fontFamily: "var(--font-display)", fontSize: 13 }}>{(e.type || "event").replace(/_/g, " ")}</b>
              {roleBadge(e.actorRole)}
              {e.amount ? <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-2)" }}>{money(e.amount, cur)}</span> : null}
            </div>
            {e.detail ? <div className="muted" style={{ fontSize: 12.5, marginTop: 1 }}>{e.detail}</div> : null}
            <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>{fdt(e.at)}{e.actor ? ` · ${e.actor}` : ""}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── comms ── */
function imageUrlOf(m?: CommunityMessage): string | null {
  if (!m) return null;
  const att = Array.isArray(m.attachments) ? m.attachments : [];
  for (const a of att) { const url = a?.url || a?.publicUrl || (typeof a === "string" ? a : ""); if (url) return url; }
  return null;
}
async function uploadImage(file: File) {
  const fd2 = new FormData(); fd2.append("file", file); fd2.append("location", "stowbo/messages");
  const r = await fetch("/api/repository/customer/file/upload", { method: "POST", body: fd2 });
  if (!r.ok) throw new Error("Upload failed.");
  const j: any = await r.json().catch(() => null);
  const rec = Array.isArray(j) ? j[0] : j?.data ?? j; const record = Array.isArray(rec) ? rec[0] : rec;
  const url = record?.url || record?.publicUrl || record?.path;
  if (!url) throw new Error("No URL returned.");
  return { url, contentType: file.type || "image/*", name: file.name };
}
function Comms({ guest, me, messages }: { guest: string; me: string; messages: CommunityMessage[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const msgs = useMemo(() => [...messages].sort((a, b) => new Date(a.sentAt || 0).getTime() - new Date(b.sentAt || 0).getTime()), [messages]);
  useEffect(() => { endRef.current?.scrollIntoView(); }, [messages]);
  function send() {
    const content = text.trim(); if (!content) return; setErr(null); setBusy(true);
    (async () => { const r = await sendMessageAction({ recipientId: guest, content }); if (r.ok) { setText(""); router.refresh(); } else setErr(r.error); setBusy(false); })();
  }
  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; setErr(null); setBusy(true);
    (async () => { try { const att = await uploadImage(file); const r = await sendMessageAction({ recipientId: guest, content: "", contentType: "image", attachments: [att] }); if (r.ok) router.refresh(); else setErr(r.error); } catch (x: any) { setErr(x?.message || "Could not send photo."); } finally { setBusy(false); } })();
  }
  return (
    <div>
      {err && <Alert kind="error" onDismiss={() => setErr(null)}>{err}</Alert>}
      <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: "4px 0 8px" }}>
        {msgs.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>No messages yet.</p> : msgs.map((m, i) => {
          const mine = (m.sender || "") === me; const img = imageUrlOf(m);
          return <div key={i} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%", background: mine ? "var(--primary)" : "var(--bg-2)", color: mine ? "#fff" : "var(--text)", borderRadius: 12, padding: img ? 4 : "7px 11px", fontSize: 13.5 }}>
            {img && <a href={img} target="_blank" rel="noreferrer">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={img} alt="" style={{ maxWidth: 180, borderRadius: 9, display: "block" }} /></a>}
            {m.content ? <div style={{ padding: img ? "5px 7px 2px" : 0 }}>{m.content}</div> : null}
          </div>;
        })}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} title="Attach photo" style={{ flex: "none", width: 38, height: 38, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer" }}>📎</button>
        <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={1} placeholder="Message the guest…" style={{ flex: 1, resize: "none", minHeight: 38, maxHeight: 120, padding: "9px 13px", borderRadius: 19, border: "1px solid var(--border)", font: "inherit", fontSize: 13.5, background: "var(--bg-2)" }} />
        <button type="button" className="btn clay" disabled={busy || !text.trim()} onClick={send} style={{ flex: "none", height: 38 }}>Send</button>
      </div>
    </div>
  );
}

/* ═══════════════ the console ═══════════════ */
export function BookingConsole({ booking, timeline, me, messages }: { booking: Envelope<StowboBooking>; timeline: BookingTimeline | null; me: string; messages: CommunityMessage[] }) {
  const router = useRouter();
  const b = booking.data;
  const cur = b.currency || "USD";
  const guest = b.customer || "";
  const items = b.items || [];
  const adjustments = (timeline?.adjustments ?? b.adjustments ?? []) as Adjustment[];
  const claims = (timeline?.claims ?? b.claims ?? []);
  const events = useMemo(() => (timeline?.timeline ?? []).slice().reverse(), [timeline]);
  const hostEarning = b.hostEarning ?? Number(b.total ?? 0) * 0.82;
  const payStatus = b.payment?.status;

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) {
    setErr(null); setOk(null);
    start(async () => { const r = await fn(); if (r.ok) { setOk(done); router.refresh(); } else setErr(r.error); });
  }

  // fulfillment inline forms
  const [fForm, setFForm] = useState<{ line: number; kind: "dropoff" | "retrieve" } | null>(null);
  const [code, setCode] = useState(""); const [cond, setCond] = useState(""); const [decl, setDecl] = useState("");
  function resetF() { setFForm(null); setCode(""); setCond(""); setDecl(""); }

  // money forms
  const [chOpen, setChOpen] = useState(false); const [chAmt, setChAmt] = useState(""); const [chCat, setChCat] = useState("damage"); const [chDesc, setChDesc] = useState("");
  const [rfOpen, setRfOpen] = useState(false); const [rfAmt, setRfAmt] = useState(""); const [rfDesc, setRfDesc] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [cancelStep, setCancelStep] = useState(false); const [cancelReason, setCancelReason] = useState("");
  // claim form
  const [clOpen, setClOpen] = useState(false); const [clType, setClType] = useState("damage"); const [clDesc, setClDesc] = useState(""); const [clAmt, setClAmt] = useState("");

  const canCancel = b.status !== "settled" && b.status !== "cancelled";
  const dateRange = items[0] ? `${fd(items[0].startDate)} → ${fd(items[0].endDate)}` : "";

  const cardStyle: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 18, marginBottom: 18 };

  return (
    <div>
      <style>{`.bcon{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:20px;align-items:start}
        @media(max-width:960px){.bcon{grid-template-columns:1fr}.bcon .bcon-side{position:static !important}}`}</style>

      {/* banners */}
      {payStatus === "void_failed" && <Alert kind="error">The guest&apos;s card hold couldn&apos;t be released — they may still have funds frozen. Contact support to clear it.</Alert>}
      {b.paymentHold && <Alert kind="info">Payout on hold{b.paymentHoldReason ? ` — ${b.paymentHoldReason}` : ""}. Your earnings are withheld until you release them.</Alert>}
      {b.status === "cancelled" && <Alert kind="info">This booking was cancelled{b.cancelReason ? ` — ${b.cancelReason}` : ""}.</Alert>}
      {err && <Alert kind="error" onDismiss={() => setErr(null)}>{err}</Alert>}
      {ok && <Alert kind="success" onDismiss={() => setOk(null)}>{ok}</Alert>}

      {/* header */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <b style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>{items[0]?.listingTitle || items[0]?.listing || "Booking"}</b>
              <Pill status={b.status} />
              {payStatus ? <span className="muted" style={{ fontSize: 12 }}>payment: {payStatus}</span> : null}
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{b.name}</div>
            <div className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>{dateRange}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar name={guest} />
            <div style={{ minWidth: 0 }}>
              <div className="eyebrow" style={{ fontSize: 10.5 }}>Guest</div>
              <div style={{ fontSize: 13.5, maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{guest}</div>
              {guest && <Link href={routes.hostThread(guest)} style={{ fontSize: 12.5, color: "var(--primary)", fontWeight: 600 }}>Message ↗</Link>}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 16 }}><StagePipeline status={b.status} /></div>
      </div>

      <div className="bcon">
        {/* MAIN */}
        <div style={{ minWidth: 0 }}>
          {/* fulfillment */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Fulfillment</h3>
            {items.map((it, i) => (
              <div key={i} style={{ borderTop: i ? "1px solid var(--border-2)" : "none", paddingTop: i ? 14 : 0, marginTop: i ? 14 : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <b style={{ fontFamily: "var(--font-display)" }}>{it.listingTitle || it.listing}{it.unit ? ` · unit ${it.unit}` : ""}</b>
                  <Pill status={it.state === "booked" ? "requested" : it.state === "stored" ? "in_custody" : it.state === "retrieved" ? "retrieved" : it.state} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12, marginTop: 10 }}>
                  <Field label="From">{fd(it.startDate)}</Field>
                  <Field label="Until">{fd(it.endDate)}</Field>
                  <Field label="Qty">{it.quantity}</Field>
                  {it.condition && <Field label="Condition">{it.condition}</Field>}
                  {it.declaredValue ? <Field label="Declared">{money(it.declaredValue, cur)}</Field> : null}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  {b.dropoffCode && <span className="fpill" style={{ fontFamily: "monospace", fontSize: 12 }}>drop-off {b.dropoffCode}</span>}
                  {b.pickupCode && <span className="fpill" style={{ fontFamily: "monospace", fontSize: 12 }}>pickup {b.pickupCode}</span>}
                </div>
                {[...(it.dropoffPhotos || []), ...(it.pickupPhotos || [])].length > 0 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {[...(it.dropoffPhotos || []), ...(it.pickupPhotos || [])].map((p: any, k) => p?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a key={k} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt="" style={{ width: 66, height: 66, objectFit: "cover", borderRadius: 8 }} /></a>
                    ) : null)}
                  </div>
                )}
                {/* actions */}
                <div style={{ marginTop: 12 }}>
                  {fForm?.line === i ? (
                    <div className="tcard" style={{ background: "var(--bg-2)" }}>
                      <div className="field"><label>{fForm.kind === "dropoff" ? "Guest drop-off code" : "Guest pickup code"}</label><input value={code} onChange={(e) => setCode(e.target.value)} autoFocus /></div>
                      <div className="frow">
                        <div className="field"><label>Condition note</label><input value={cond} onChange={(e) => setCond(e.target.value)} /></div>
                        {fForm.kind === "dropoff" && <div className="field"><label>Declared value</label><input type="number" value={decl} onChange={(e) => setDecl(e.target.value)} /></div>}
                      </div>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button className="btn clay" disabled={pending || !code.trim()} onClick={() => run(() => fForm.kind === "dropoff"
                          ? dropoffAction(b.name, { code: code.trim(), line: i, unit: it.unit, condition: cond.trim() || undefined, declaredValue: decl ? Number(decl) : undefined })
                          : retrieveAction(b.name, { code: code.trim(), line: i, condition: cond.trim() || undefined }), fForm.kind === "dropoff" ? "Drop-off accepted." : "Handed back.")}>{pending ? "Confirming…" : "Confirm"}</button>
                        <button className="btn ghost" onClick={resetF}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {it.state === "booked" && <button className="btn clay" onClick={() => { resetF(); setFForm({ line: i, kind: "dropoff" }); }}>Accept drop-off</button>}
                      {it.state === "stored" && <button className="btn clay" onClick={() => { resetF(); setFForm({ line: i, kind: "retrieve" }); }}>Hand back</button>}
                      {it.state === "retrieved" && <button className="btn clay" disabled={pending} onClick={() => run(() => settleAction(b.name), "Settled — earnings on the way.")}>Settle &amp; get paid</button>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* payment ledger */}
          <div style={cardStyle}>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Payment</h3>
            <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
              <Row label="Subtotal" value={money(b.subtotal, cur)} />
              {b.addOnTotal ? <Row label="Add-ons" value={money(b.addOnTotal, cur)} /> : null}
              {b.overstayCharge ? <Row label="Overstay" value={money(b.overstayCharge, cur)} /> : null}
              {adjustments.map((a) => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, opacity: a.reversedBy ? 0.5 : 1 }}>
                  <span style={{ textDecoration: a.reversedBy ? "line-through" : "none" }}>
                    {a.kind} · {a.description || a.category}
                    {!a.reversedBy && !a.reversalOf && <button onClick={() => run(() => reverseAdjustmentAction(b.name, a.id), "Adjustment reversed.")} disabled={pending} style={{ marginLeft: 8, background: "none", border: 0, color: "var(--primary)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>reverse</button>}
                  </span>
                  <b style={{ color: signed(a) >= 0 ? "var(--text)" : "var(--accent-strong)" }}>{signed(a) >= 0 ? "+" : "−"}{money(Math.abs(a.amount), cur)}</b>
                </div>
              ))}
              <div style={{ borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700, fontFamily: "var(--font-display)" }}><span>Total charged</span><span>{money(b.total, cur)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--accent-strong)", fontWeight: 700, fontFamily: "var(--font-display)" }}><span>Your earnings{b.paymentHold ? " (held)" : ""}</span><span>{money(hostEarning, cur)}</span></div>
            </div>

            {/* money actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button className="btn ghost sm" onClick={() => { setChOpen((v) => !v); setRfOpen(false); }}>＋ Charge guest</button>
              <button className="btn ghost sm" onClick={() => { setRfOpen((v) => !v); setChOpen(false); }}>Refund</button>
              {b.paymentHold
                ? <button className="btn ghost sm" disabled={pending} onClick={() => run(() => releasePaymentAction(b.name), "Payout released.")}>Release payout</button>
                : <button className="btn ghost sm" disabled={pending} onClick={() => run(() => holdPaymentAction(b.name, holdReason || undefined), "Payout held.")}>Hold payout</button>}
              {canCancel && !cancelStep && <button className="btn ghost sm" style={{ color: "var(--primary-strong)", marginLeft: "auto" }} onClick={() => setCancelStep(true)}>Cancel booking</button>}
            </div>

            {chOpen && (
              <div className="tcard" style={{ background: "var(--bg-2)", marginTop: 12 }}>
                <div className="frow">
                  <div className="field"><label>Amount</label><input type="number" min={0} step="0.5" value={chAmt} onChange={(e) => setChAmt(e.target.value)} placeholder="0.00" /></div>
                  <div className="field"><label>Category</label><select value={chCat} onChange={(e) => setChCat(e.target.value)}>{["damage", "overstay", "cleaning", "lost_key", "disposal", "other"].map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}</select></div>
                </div>
                <div className="field"><label>Description</label><input value={chDesc} onChange={(e) => setChDesc(e.target.value)} /></div>
                <button className="btn clay" disabled={pending || !chAmt} onClick={() => { run(() => chargeGuestAction(b.name, { amount: Number(chAmt), category: chCat, description: chDesc.trim() || undefined }), "Charge added."); setChOpen(false); setChAmt(""); setChDesc(""); }}>Charge {chAmt ? money(Number(chAmt), cur) : ""}</button>
              </div>
            )}
            {rfOpen && (
              <div className="tcard" style={{ background: "var(--bg-2)", marginTop: 12 }}>
                <div className="frow">
                  <div className="field"><label>Amount</label><input type="number" min={0} step="0.5" value={rfAmt} onChange={(e) => setRfAmt(e.target.value)} placeholder="0.00" /></div>
                  <div className="field"><label>Reason</label><input value={rfDesc} onChange={(e) => setRfDesc(e.target.value)} /></div>
                </div>
                <button className="btn clay" disabled={pending || !rfAmt} onClick={() => { run(() => refundGuestAction(b.name, { amount: Number(rfAmt), description: rfDesc.trim() || undefined }), "Refund issued."); setRfOpen(false); setRfAmt(""); setRfDesc(""); }}>Refund {rfAmt ? money(Number(rfAmt), cur) : ""}</button>
              </div>
            )}
            {cancelStep && (
              <div className="tcard" style={{ background: "#fbe9e2", marginTop: 12, border: "1px solid #e7b39c" }}>
                <p style={{ margin: "0 0 8px", fontWeight: 600, color: "#a5401f" }}>Cancel this booking? This frees the unit and voids the guest&apos;s card hold.</p>
                <div className="field"><label>Reason (optional)</label><input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} /></div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn clay" disabled={pending} onClick={() => { run(() => cancelBookingAction(b.name, cancelReason.trim() || undefined), "Booking cancelled."); setCancelStep(false); }}>Yes, cancel booking</button>
                  <button className="btn ghost" onClick={() => setCancelStep(false)}>Keep it</button>
                </div>
              </div>
            )}
          </div>

          {/* support / claims */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 16 }}>Support &amp; claims</h3>
              <button className="btn ghost sm" onClick={() => setClOpen((v) => !v)}>Open a claim</button>
            </div>
            {clOpen && (
              <div className="tcard" style={{ background: "var(--bg-2)", marginTop: 12 }}>
                <div className="frow">
                  <div className="field"><label>Type</label><select value={clType} onChange={(e) => setClType(e.target.value)}>{["damage", "dispute", "other"].map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div className="field"><label>Claimed amount</label><input type="number" min={0} value={clAmt} onChange={(e) => setClAmt(e.target.value)} /></div>
                </div>
                <div className="field"><label>Description</label><textarea rows={2} value={clDesc} onChange={(e) => setClDesc(e.target.value)} /></div>
                <button className="btn clay" disabled={pending || !clDesc.trim()} onClick={() => { run(() => openClaimAction(b.name, { type: clType, description: clDesc.trim(), claimedAmount: clAmt ? Number(clAmt) : undefined }), "Claim opened."); setClOpen(false); setClDesc(""); setClAmt(""); }}>Open claim</button>
              </div>
            )}
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {claims.length === 0 ? <p className="muted" style={{ fontSize: 13, margin: 0 }}>No claims on this booking.</p> : claims.map((c: any) => (
                <div key={c.id} style={{ padding: "10px 12px", background: "var(--bg-2)", borderRadius: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <b style={{ fontFamily: "var(--font-display)" }}>{c.type} {roleBadge(c.openedByRole)}</b>
                    <span style={{ display: "flex", gap: 8, alignItems: "center" }}>{c.claimedAmount ? <b>{money(c.claimedAmount, cur)}</b> : null}<span className="fpill" style={{ fontSize: 11 }}>{c.status}</span></span>
                  </div>
                  {c.description && <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{c.description}</div>}
                  <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 3 }}>{fdt(c.openedAt)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SIDE */}
        <div className="bcon-side" style={{ minWidth: 0, position: "sticky", top: 100, display: "grid", gap: 18 }}>
          <div style={cardStyle}>
            <h3 style={{ fontSize: 16, marginBottom: 6 }}>Activity</h3>
            <p className="hint" style={{ marginTop: 0 }}>Everything on this booking — yours and the guest&apos;s.</p>
            <ActivityFeed events={events} cur={cur} />
          </div>
          <div style={cardStyle}>
            <h3 style={{ fontSize: 16, marginBottom: 10 }}>Messages</h3>
            <Comms guest={guest} me={me} messages={messages} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span className="muted">{label}</span><span>{value}</span></div>;
}
