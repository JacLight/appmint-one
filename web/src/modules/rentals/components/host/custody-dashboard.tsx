"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert } from "@/components/alert";
import { routes } from "@/lib/nav";
import { formatMoney } from "@/lib/utils";
import { dropoffAction, retrieveAction, settleAction } from "@/modules/rentals/actions/host";
import { sendMessageAction } from "@/app/actions/community";
import type { Envelope } from "@/lib/api";
import type { StowboBooking, BookingItem, FileInfo } from "@/api/rentals";
import type { CommunityMessage } from "@/lib/community";

/* ── date helpers (guard empty / invalid) ── */
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const stampFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
function toDate(v?: string) {
  if (!v) return null;
  const t = new Date(v);
  return isNaN(t.getTime()) ? null : t;
}
const fmtDate = (v?: string) => { const t = toDate(v); return t ? dateFmt.format(t) : "—"; };
const fmtStamp = (v?: string) => { const t = toDate(v); return t ? stampFmt.format(t) : ""; };

/* ── state presentation ── */
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

const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 };
const h2: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, margin: "0 0 14px" };

function money(v: number | undefined, cur: string) { return formatMoney((v ?? 0) * 100, cur); }
function photosOf(items: BookingItem[]): FileInfo[] {
  return items.flatMap((it) => [...(it.dropoffPhotos ?? []), ...(it.pickupPhotos ?? [])]).filter((f) => f?.url);
}

export function CustodyDashboard({ booking, me, messages }: { booking: Envelope<StowboBooking>; me: string; messages: CommunityMessage[] }) {
  const b = booking.data;
  const items = b.items ?? [];
  const cur = b.currency || "USD";
  const guest = b.customer || "";
  const commsRef = useRef<HTMLDivElement>(null);

  return (
    <div className="cust-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)", gap: 20, alignItems: "start" }}>
      <style>{`@media (max-width: 900px){ .cust-grid{ grid-template-columns: 1fr !important; } }`}</style>

      {/* ───── MAIN COLUMN ───── */}
      <div style={{ display: "grid", gap: 20, minWidth: 0 }}>
        {/* header */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, margin: 0 }}>{items[0]?.listingTitle || items[0]?.listing || "Storage"}</h1>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4, fontFamily: "monospace" }}>{b.name}</div>
            </div>
            <Badge state={items[0]?.state || b.status} />
          </div>
          {/* guest */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-2)", minWidth: 0 }}>
            <span style={{ flex: "none", width: 42, height: 42, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17 }}>
              {(guest || "?").charAt(0).toUpperCase()}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="eyebrow" style={{ fontSize: 11 }}>Guest</div>
              <div style={{ fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={guest}>{guest || "—"}</div>
            </div>
            {guest && (
              <button className="btn ghost sm" onClick={() => commsRef.current?.scrollIntoView({ behavior: "smooth" })} style={{ flex: "none" }}>Message guest</button>
            )}
          </div>
        </div>

        {/* actions per item */}
        <div style={card}>
          <h2 style={h2}>Manage this storage</h2>
          <div style={{ display: "grid", gap: 14 }}>
            {items.map((it, i) => (
              <ItemActions key={i} bookingName={b.name} item={it} index={i} multi={items.length > 1} />
            ))}
          </div>
        </div>

        {/* booking details */}
        <div style={card}>
          <h2 style={h2}>Booking details</h2>
          <div style={{ display: "grid", gap: 16 }}>
            {items.map((it, i) => (
              <div key={i} style={{ borderTop: i ? "1px solid var(--border-2)" : "none", paddingTop: i ? 16 : 0 }}>
                {items.length > 1 && <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{it.listingTitle || it.listing}</div>}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14 }}>
                  <Field label="From">{fmtDate(it.startDate)}</Field>
                  <Field label="Until">{fmtDate(it.endDate)}</Field>
                  <Field label="Quantity">{it.quantity}</Field>
                  {it.unit && <Field label="Unit">{it.unit}</Field>}
                  {it.condition && <Field label="Condition">{it.condition}</Field>}
                  {it.declaredValue != null && <Field label="Declared value">{money(it.declaredValue, cur)}</Field>}
                  {Array.isArray(it.tags) && it.tags.length > 0 && <Field label="Tags">{it.tags.join(", ")}</Field>}
                </div>
                {/* codes */}
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 12 }}>
                  <CodeChip label="Drop-off code" value={b.dropoffCode} />
                  <CodeChip label="Pickup code" value={b.pickupCode} />
                </div>
                {/* add-ons */}
                {Array.isArray(it.addOns) && it.addOns.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div className="eyebrow" style={{ fontSize: 11, marginBottom: 6 }}>Add-ons</div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {it.addOns.map((a, j) => (
                        <div key={j} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, gap: 12 }}>
                          <span>{a.name}{a.quantity > 1 ? ` × ${a.quantity}` : ""} <span className="muted" style={{ fontSize: 12 }}>/ {a.chargeEvery}</span></span>
                          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>{money(a.subtotal ?? a.price * (a.quantity || 1), cur)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* photos */}
        <div style={card}>
          <h2 style={h2}>Photos</h2>
          <Photos items={items} />
        </div>

        {/* comms */}
        <div style={card} ref={commsRef}>
          <h2 style={h2}>Messages with guest</h2>
          <Comms me={me} guest={guest} messages={messages} />
        </div>
      </div>

      {/* ───── SIDE COLUMN ───── */}
      <div style={{ display: "grid", gap: 20, minWidth: 0, position: "sticky", top: 100 }}>
        {/* payment */}
        <div style={{ ...card, background: "var(--text)", color: "#fff" }}>
          <div className="eyebrow" style={{ color: "var(--pop)" }}>Your earnings</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 700, marginTop: 4 }}>{money(b.hostEarning ?? b.total * 0.82, cur)}</div>
          <div style={{ fontSize: 12.5, color: "#b7b3a6", marginTop: 2 }}>{b.status === "settled" ? "Paid to your wallet" : "Lands in your wallet on settle (you keep 82%)"}</div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.14)", display: "grid", gap: 8, fontSize: 13.5 }}>
            <Row light label="Subtotal" value={money(b.subtotal, cur)} />
            {b.addOnTotal > 0 && <Row light label="Add-ons" value={money(b.addOnTotal, cur)} />}
            {b.overstayCharge > 0 && <Row light label="Overstay" value={money(b.overstayCharge, cur)} />}
            {b.platformFee != null && <Row light label="Platform fee" value={`– ${money(b.platformFee, cur)}`} />}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,.14)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
              <span>Total charged</span><span>{money(b.total, cur)}</span>
            </div>
          </div>
        </div>

        {/* activity */}
        <div style={card}>
          <h2 style={h2}>Activity</h2>
          <Timeline booking={booking} />
        </div>
      </div>
    </div>
  );
}

/* ───────── sub-components ───────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="eyebrow" style={{ fontSize: 11 }}>{label}</div>
      <div style={{ fontSize: 14, marginTop: 2, overflowWrap: "anywhere" }}>{children}</div>
    </div>
  );
}

function Row({ label, value, light }: { label: string; value: string; light?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", color: light ? "#d8d4c7" : "var(--text-2)" }}>
      <span>{label}</span><span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function CodeChip({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <div className="eyebrow" style={{ fontSize: 11 }}>{label}</div>
      <code style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, letterSpacing: 1, background: "var(--bg-2)", padding: "3px 10px", borderRadius: 8, display: "inline-block", marginTop: 3 }}>{value}</code>
    </div>
  );
}

function ItemActions({ bookingName, item, index, multi }: { bookingName: string; item: BookingItem; index: number; multi: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<null | "dropoff" | "retrieve">(null);
  const [code, setCode] = useState("");
  const [condition, setCondition] = useState("");
  const [declaredValue, setDeclaredValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function reset() { setForm(null); setCode(""); setCondition(""); setDeclaredValue(""); }
  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) {
    setError(null); setOk(null);
    start(async () => {
      const r = await fn();
      if (r.ok) { setOk(done); reset(); router.refresh(); } else setError(r.error);
    });
  }

  const label = STATE[item.state]?.label || item.state;

  return (
    <div style={{ border: "1px solid var(--border-2)", borderRadius: 12, padding: 14, background: "var(--bg-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14 }}>
          {multi ? `${item.listingTitle || item.listing} · ` : ""}<span className="muted">{label}</span>
        </div>
      </div>

      {error && <div style={{ marginTop: 10 }}><Alert kind="error" onDismiss={() => setError(null)}>{error}</Alert></div>}
      {ok && <div style={{ marginTop: 10 }}><Alert kind="success" onDismiss={() => setOk(null)}>{ok}</Alert></div>}

      {/* booked → accept drop-off */}
      {item.state === "booked" && (form === "dropoff" ? (
        <div style={{ marginTop: 12 }}>
          <p className="hint" style={{ marginTop: 0 }}>Ask the guest for the drop-off code on their booking, then confirm.</p>
          <div className="field"><label>Guest drop-off code</label><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 4821" autoFocus /></div>
          <div className="frow">
            <div className="field"><label>Condition note (optional)</label><input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="Sealed, no damage" /></div>
            <div className="field"><label>Declared value (optional)</label><input type="number" min={0} value={declaredValue} onChange={(e) => setDeclaredValue(e.target.value)} placeholder="0" /></div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button className="btn clay" disabled={pending || !code.trim()} onClick={() => run(() => dropoffAction(bookingName, { code: code.trim(), line: index, unit: item.unit, condition: condition.trim() || undefined, declaredValue: declaredValue ? Number(declaredValue) : undefined }), "Drop-off accepted — the item is now in your care.")}>{pending ? "Confirming…" : "Confirm drop-off"}</button>
            <button className="btn ghost" disabled={pending} onClick={reset}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}><button className="btn clay" onClick={() => { setForm("dropoff"); setOk(null); }}>Accept drop-off</button></div>
      ))}

      {/* stored → hand back */}
      {item.state === "stored" && (form === "retrieve" ? (
        <div style={{ marginTop: 12 }}>
          <p className="hint" style={{ marginTop: 0 }}>The guest shows their pickup code — no matching code, no hand-back.</p>
          <div className="field"><label>Guest pickup code</label><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 7305" autoFocus /></div>
          <div className="field"><label>Condition note (optional)</label><input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="Returned as received" /></div>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button className="btn clay" disabled={pending || !code.trim()} onClick={() => run(() => retrieveAction(bookingName, { code: code.trim(), line: index, condition: condition.trim() || undefined }), "Handed back. Settle it to get paid.")}>{pending ? "Confirming…" : "Confirm hand-back"}</button>
            <button className="btn ghost" disabled={pending} onClick={reset}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}><button className="btn clay" onClick={() => { setForm("retrieve"); setOk(null); }}>Hand back to guest</button></div>
      ))}

      {/* retrieved → settle */}
      {item.state === "retrieved" && (
        <div style={{ marginTop: 12 }}><button className="btn clay" disabled={pending} onClick={() => run(() => settleAction(bookingName), "Settled — your earnings are on the way to your wallet.")}>{pending ? "Settling…" : "Settle & get paid"}</button></div>
      )}

      {["damaged", "lost", "abandoned"].includes(item.state) && (
        <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>This line is marked <b>{item.state}</b>. Reach out to Stowbo support to resolve it.</p>
      )}
    </div>
  );
}

function Timeline({ booking }: { booking: Envelope<StowboBooking> }) {
  const b = booking.data;
  const steps: { label: string; at?: string }[] = [
    { label: "Booked", at: booking.createdate },
    ...b.items.flatMap((it) => [
      { label: "Dropped off", at: it.droppedOffAt },
      { label: "Retrieved", at: it.retrievedAt },
    ]),
    { label: "Settled", at: b.settledAt },
    { label: "Cancelled", at: b.cancelledAt },
  ].filter((s) => s.at);

  if (steps.length === 0) return <p className="muted" style={{ fontSize: 13 }}>No activity yet.</p>;
  steps.sort((a, z) => new Date(a.at!).getTime() - new Date(z.at!).getTime());

  return (
    <div style={{ display: "grid", gap: 0 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--primary)", marginTop: 4 }} />
            {i < steps.length - 1 && <span style={{ width: 2, flex: 1, background: "var(--border)", minHeight: 22 }} />}
          </div>
          <div style={{ paddingBottom: i < steps.length - 1 ? 14 : 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14 }}>{s.label}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>{fmtStamp(s.at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Photos({ items }: { items: BookingItem[] }) {
  const photos = photosOf(items);
  if (photos.length === 0) return <p className="muted" style={{ fontSize: 13 }}>No photos yet. Drop-off and pickup photos will appear here.</p>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {photos.map((f, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <a key={i} href={f.url} target="_blank" rel="noreferrer" style={{ display: "block" }}>
          <img src={f.url} alt="" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)" }} />
        </a>
      ))}
    </div>
  );
}

function Comms({ me, guest, messages }: { me: string; guest: string; messages: CommunityMessage[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function imgUrl(m: CommunityMessage): string | null {
    const a = m.attachments?.[0];
    const url = a?.url || a?.publicUrl;
    if (m.contentType === "image" && url) return url;
    if (url && /\.(png|jpe?g|gif|webp|avif)$/i.test(url)) return url;
    return null;
  }

  function send() {
    if (!text.trim()) return;
    setError(null);
    start(async () => {
      const r = await sendMessageAction({ recipientId: guest, content: text });
      if (r.ok) { setText(""); router.refresh(); } else setError(r.error);
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null); setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("location", "stowbo/messages");
      const res = await fetch("/api/repository/customer/file/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const j = await res.json().catch(() => ({}));
      const rec = Array.isArray(j) ? j[0] : (j?.data ?? j);
      const url = rec?.url || rec?.publicUrl || (Array.isArray(rec) ? rec[0]?.url : undefined);
      if (!url) throw new Error("Upload returned no URL");
      const r = await sendMessageAction({ recipientId: guest, content: "", contentType: "image", attachments: [{ url, contentType: file.type, name: file.name }] });
      if (!r.ok) throw new Error(r.error);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Could not attach the image.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (!guest) return <p className="muted" style={{ fontSize: 13 }}>No guest on this booking to message.</p>;

  return (
    <div>
      <div style={{ display: "grid", gap: 8, maxHeight: 360, overflowY: "auto", marginBottom: 12, paddingRight: 4 }}>
        {messages.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No messages yet. Say hello, share the access details, or send a photo.</p>}
        {messages.map((m, i) => {
          const mine = m.sender === me;
          const url = imgUrl(m);
          return (
            <div key={i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "76%", background: mine ? "var(--primary)" : "var(--bg-2)", color: mine ? "#fff" : "var(--text)", borderRadius: 14, padding: url ? 6 : "8px 12px" }}>
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="" style={{ maxWidth: 220, borderRadius: 10, display: "block" }} /></a>
                ) : (
                  <span style={{ fontSize: 14, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>{m.content}</span>
                )}
                {m.sentAt && <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 3, textAlign: mine ? "right" : "left" }}>{fmtStamp(m.sentAt)}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {error && <Alert kind="error" onDismiss={() => setError(null)}>{error}</Alert>}

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
        <button className="btn ghost" type="button" disabled={uploading || pending} onClick={() => fileRef.current?.click()} title="Attach a photo" style={{ flex: "none" }}>{uploading ? "…" : "📎"}</button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Message the guest…"
          rows={2}
          style={{ flex: 1, resize: "vertical", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border)", font: "inherit", fontSize: 14, background: "var(--surface)" }}
        />
        <button className="btn clay" type="button" disabled={pending || uploading || !text.trim()} onClick={send} style={{ flex: "none" }}>{pending ? "Sending…" : "Send"}</button>
      </div>
    </div>
  );
}
