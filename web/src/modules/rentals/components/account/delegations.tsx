"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDelegationAction, resendDelegationAction, revokeDelegationAction } from "@/modules/rentals/actions/delegation";
import { fmtFull } from "@/lib/dates";
import type { MyItem, PickupDelegation } from "@/api/rentals";

const VERIFY: { k: "qr" | "qr_name" | "qr_id"; label: string; hint: string }[] = [
  { k: "qr_id", label: "QR + photo ID", hint: "Safest — the host checks their ID against the name you give." },
  { k: "qr_name", label: "QR + name", hint: "They show the QR and give their name." },
  { k: "qr", label: "QR only", hint: "Anyone holding the pass can collect." },
];
const STATE: Record<string, { label: string; cls: string }> = {
  active: { label: "Live", cls: "ok" }, completed: { label: "Collected", cls: "done" }, revoked: { label: "Cancelled", cls: "off" }, expired: { label: "Expired", cls: "off" },
};
const itemName = (i: { label?: string | null; identifier?: string | null; unit?: string | null }, n: number) => i.label || i.identifier || (i.unit ? `bay ${i.unit}` : `Item ${n}`);

/** "Someone else is collecting": the owner hands the pickup of chosen items to a named
 *  person. The server issues that person their own QR code and pass link (sent by text /
 *  email), and while it's live the owner's own code no longer releases those items. */
export function Delegations({ bookingId, items, delegations, bookingEnd }: {
  bookingId: string;
  /** this booking's items, from the owner's my-items list */
  items: MyItem[];
  delegations: PickupDelegation[];
  bookingEnd?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<{ id: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const live = delegations.filter((d) => d.status === "active");
  const taken = new Set(live.flatMap((d) => d.items));
  const collectible = items.filter((i) => !i.checkedOutAt && i.status !== "ended" && i.status !== "cancelled");
  const free = collectible.filter((i) => !taken.has(i.id));

  // Unnamed items are numbered by their place in the booking, so "Item 2" means the
  // same thing in the picker, in the list, and on the host's screen.
  const nameOf = (i: { id?: string; label?: string | null; identifier?: string | null; unit?: string | null }, fallback: number) => {
    const idx = i.id ? items.findIndex((x) => x.id === i.id) : -1;
    return itemName(i, idx >= 0 ? idx + 1 : fallback);
  };

  const [f, setF] = useState({ items: [] as string[], name: "", phone: "", email: "", verify: "qr_id" as "qr" | "qr_name" | "qr_id", validUntil: "", note: "" });
  const toggle = (id: string) => setF((s) => ({ ...s, items: s.items.includes(id) ? s.items.filter((x) => x !== id) : [...s.items, id] }));

  function create() {
    setMsg(null);
    start(async () => {
      const r = await createDelegationAction(bookingId, {
        items: f.items.length ? f.items : free.map((i) => i.id),
        name: f.name, phone: f.phone, email: f.email, verify: f.verify,
        validUntil: f.validUntil ? new Date(f.validUntil).toISOString() : undefined, note: f.note || undefined,
      });
      if (r.ok) {
        setOpen(false); setF({ items: [], name: "", phone: "", email: "", verify: "qr_id", validUntil: "", note: "" });
        setMsg({ kind: "ok", text: `Pass sent to ${r.data.delegate?.name || r.data.delegate?.phone || r.data.delegate?.email}. Their code: ${r.data.code}.` });
        if (r.data.passUrl) setLink({ id: r.data.id, url: r.data.passUrl });
        router.refresh();
      } else setMsg({ kind: "err", text: r.error });
    });
  }
  function resend(d: PickupDelegation) {
    setMsg(null);
    start(async () => {
      const r = await resendDelegationAction(d.id, bookingId);
      if (r.ok) { setMsg({ kind: "ok", text: "A fresh pass was sent; the old link no longer works." }); if (r.data.passUrl) setLink({ id: d.id, url: r.data.passUrl }); router.refresh(); }
      else setMsg({ kind: "err", text: r.error });
    });
  }
  function revoke(d: PickupDelegation) {
    setMsg(null);
    start(async () => {
      const r = await revokeDelegationAction(d.id, bookingId);
      if (r.ok) { setMsg({ kind: "ok", text: "Cancelled — those items are back on your own pickup code." }); if (link?.id === d.id) setLink(null); router.refresh(); }
      else setMsg({ kind: "err", text: r.error });
    });
  }
  const copy = (url: string) => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); };

  if (collectible.length === 0 && delegations.length === 0) return null;

  return (
    <div className="tcard bkd-card dlg">
      <div className="dlg-head">
        <div>
          <h3>Someone else collecting?</h3>
          <p className="muted">Hand the pickup to a friend, a buyer, a courier. They get their own QR pass; the host checks what you choose before handing over.</p>
        </div>
        {free.length > 0 && <button type="button" className="btn clay sm" onClick={() => { setOpen(!open); setMsg(null); }}>{open ? "Cancel" : "Hand pickup to someone"}</button>}
      </div>

      {msg && <div className={msg.kind === "ok" ? "set-ok" : "bp-error"} style={{ marginBottom: 10 }}>{msg.text}</div>}
      {link && (
        <div className="dlg-link">
          <span>Their pass link (share it yourself too):</span>
          <input readOnly value={link.url} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="btn ghost sm" onClick={() => copy(link.url)}>{copied ? "Copied" : "Copy"}</button>
        </div>
      )}

      {open && (
        <div className="ao-form dlg-form">
          {collectible.length > 1 && (
            <div className="set-field"><span>What they’re collecting <em>(none ticked = everything not yet handed off)</em></span>
              <div className="cpm-scope">
                {free.map((i, n) => (
                  <label key={i.id} className={`cpm-scope-item${f.items.includes(i.id) ? " on" : ""}`}>
                    <input type="checkbox" checked={f.items.includes(i.id)} onChange={() => toggle(i.id)} /><span>{nameOf(i, n + 1)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="ao-row2">
            <label className="set-field"><span>Their name</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Who is collecting" autoComplete="off" /></label>
            <label className="set-field"><span>Mobile <em>(pass is texted here)</em></span><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+1 214…" inputMode="tel" /></label>
          </div>
          <div className="ao-row2">
            <label className="set-field"><span>Email <em>(or / and)</em></span><input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="them@example.com" inputMode="email" /></label>
            <label className="set-field"><span>Collect by <em>(can’t pass the booking end)</em></span><input type="datetime-local" value={f.validUntil} max={bookingEnd ? bookingEnd.slice(0, 16) : undefined} onChange={(e) => setF({ ...f, validUntil: e.target.value })} /></label>
          </div>
          <div className="set-field"><span>What the host checks before handing over</span>
            <div className="dlg-verify">
              {VERIFY.map((v) => (
                <label key={v.k} className={`dlg-verify-opt${f.verify === v.k ? " on" : ""}`}>
                  <input type="radio" name="verify" checked={f.verify === v.k} onChange={() => setF({ ...f, verify: v.k })} />
                  <span><b>{v.label}</b><em>{v.hint}</em></span>
                </label>
              ))}
            </div>
          </div>
          <label className="set-field"><span>Note for them <em>(optional)</em></span><textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Where to park, what to bring, who to ask for…" /></label>
          <button type="button" className="btn clay" disabled={pending || (!f.phone.trim() && !f.email.trim())} onClick={create}>{pending ? "Sending…" : "Send them the pass"}</button>
        </div>
      )}

      {delegations.length > 0 && (
        <div className="dlg-list">
          {delegations.map((d) => {
            const st = STATE[d.status] || { label: d.status, cls: "off" };
            const who = d.delegate?.name || d.delegate?.phone || d.delegate?.email || "Someone";
            const what = (d.itemDetails ?? []).map((i, n) => nameOf(i, n + 1)).join(", ") || `${d.items.length} item${d.items.length === 1 ? "" : "s"}`;
            return (
              <div className={`dlg-row st-${d.status}`} key={d.id}>
                <div className="dlg-main">
                  <b>{who} <span className={`hp-pill ${st.cls === "ok" ? "ok" : st.cls === "done" ? "ok" : "off"}`}>{st.label}</span></b>
                  <span className="dlg-meta">{what} · {d.verifyLabel}{d.validUntil ? ` · by ${fmtFull(d.validUntil)}` : ""}{d.sentVia && d.sentVia !== "none" ? ` · sent by ${d.sentVia === "both" ? "text & email" : d.sentVia === "sms" ? "text" : "email"}` : ""}</span>
                  {d.status === "active" && <span className="dlg-meta">Their code: <code className="cp-code">{d.code}</code></span>}
                  {d.status === "completed" && <span className="dlg-meta">Collected{d.collectedBy ? ` by ${d.collectedBy}` : ""}{d.completedAt ? ` · ${fmtFull(d.completedAt)}` : ""}</span>}
                </div>
                {d.status === "active" && (
                  <div className="dlg-actions">
                    <button type="button" className="ht-link" disabled={pending} onClick={() => resend(d)}>Resend pass</button>
                    <button type="button" className="ht-link danger" disabled={pending} onClick={() => revoke(d)}>Cancel</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
