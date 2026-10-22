"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startReturnAction } from "../actions/account";
import { REASONS, REASON_LABEL, type ReasonCategory } from "../lib/config";
import type { OrderLine } from "../lib/types";
import { money2 } from "../lib/money";
import { Icon } from "./icons";

/** Start a return: pick the items and how many, why, and their condition. The refund
 *  is worked out by the shop from the order — this only asks. */
export function ReturnForm({ orderNumber, lines, currency }: { orderNumber: string; lines: OrderLine[]; currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReasonCategory | "">("");
  const [cond, setCond] = useState<"unopened" | "opened" | "damaged" | "defective" | "wrong_item">("unopened");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const returnable = lines.filter((l) => l.sku);

  if (done) return <div className="sf-banner ok"><Icon name="check" size={16} />Return {done} requested. We’ll email the label and next steps.</div>;
  if (!open) return <button className="sf-btn ghost" onClick={() => setOpen(true)}><Icon name="ret" size={16} />Start a return</button>;
  return (
    <div className="sf-return">
      <h3>Start a return</h3>
      <ul>
        {returnable.map((l) => (
          <li key={l.sku}>
            <label className="sf-return-item">
              <input type="checkbox" checked={(qty[l.sku!] || 0) > 0} onChange={(e) => setQty({ ...qty, [l.sku!]: e.target.checked ? l.quantity : 0 })} />
              {l.image && <img src={l.image} alt="" />}
              <span><b>{l.name}</b><small>{money2(l.price, currency)} · bought {l.quantity}</small></span>
            </label>
            {(qty[l.sku!] || 0) > 0 && l.quantity > 1 && (
              <select aria-label="How many" value={qty[l.sku!]} onChange={(e) => setQty({ ...qty, [l.sku!]: Number(e.target.value) })}>
                {Array.from({ length: l.quantity }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
          </li>
        ))}
      </ul>
      <div className="sf-form">
        <label>Reason
          <select value={reason} onChange={(e) => setReason(e.target.value as ReasonCategory)}>
            <option value="">Choose a reason</option>
            {REASONS.map((r) => <option key={r} value={r}>{REASON_LABEL[r]}</option>)}
          </select>
        </label>
        <label>Condition
          <select value={cond} onChange={(e) => setCond(e.target.value as typeof cond)}>
            <option value="unopened">Unopened</option><option value="opened">Opened, like new</option><option value="damaged">Damaged</option><option value="defective">Doesn’t work</option><option value="wrong_item">Wrong item</option>
          </select>
        </label>
        <label className="full">Anything we should know? <em>optional</em><textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      </div>
      {err && <p className="sf-err">{err}</p>}
      <div className="sf-return-acts">
        <button className="sf-btn" disabled={pending} onClick={() => start(async () => {
          setErr(null);
          if (!reason) { setErr("Choose a reason."); return; }
          const picks = Object.entries(qty).filter(([, q]) => q > 0).map(([sku, quantity]) => ({ sku, quantity }));
          const r = await startReturnAction(orderNumber, picks, reason, note, cond);
          if (!r.ok) { setErr(r.error); return; }
          setDone(r.rma); router.refresh();
        })}>{pending ? "Sending…" : "Request return"}</button>
        <button className="sf-link" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
