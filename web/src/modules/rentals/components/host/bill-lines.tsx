"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { routes } from "@/lib/nav";
import { reverseLineAction, addCatalogAddonAction } from "@/modules/rentals/actions/host";
import { formatMoney } from "@/lib/utils";
import type { BookingItem, BookingDue, StowboAddOn } from "@/api/rentals";

const KIND_LABEL: Record<string, string> = {
  space: "Space", addon: "Add-on", fee: "Fee", tax: "Tax", discount: "Discount",
  charge: "Charge", refund: "Refund", waiver: "Waived", credit: "Credit",
};
const PAY_STATE: Record<string, { label: string; cls: string }> = {
  paid: { label: "Paid", cls: "ok" }, partial: { label: "Part paid", cls: "warn" },
  unpaid: { label: "Unpaid", cls: "due" }, metered: { label: "Meter running", cls: "warn" }, free: { label: "Free", cls: "ok" },
};

/** Every line on the bill — space, add-ons, fees, extra charges, credits — straight
 *  from the booking's items[] (that IS the bill; nothing is summed client-side except
 *  for display). Reversed lines stay, struck through, next to their reversal row.
 *  The host can undo a line they added (never the space, a fee or a platform line) and
 *  add a catalog add-on — paid or free — from the counter. */
export function BillLines({ bookingId, reference, items, currency = "USD", due, catalog, editable }: {
  bookingId: string;
  /** the human booking ref (#name) — goes on the payment request */
  reference?: string;
  items: BookingItem[];
  currency?: string;
  due: BookingDue | null;
  /** the listing's add-on catalog (what this space offers) */
  catalog: StowboAddOn[];
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [pick, setPick] = useState(false);
  const [choice, setChoice] = useState("");
  const [qty, setQty] = useState(1);

  const money = (n: number) => formatMoney(Math.round((n ?? 0) * 100), currency);
  const total = items.reduce((s, l) => s + Number(l.amount ?? l.subtotal ?? 0), 0);
  const state = due ? PAY_STATE[due.payState] : null;

  const kindOf = (l: BookingItem) => l.kind || "space";
  /** A line the HOST may undo: something they (or the guest) added — not the stay itself,
   *  not a fee/tax, not a platform line, not already reversed and not itself a reversal. */
  const reversible = (l: BookingItem) =>
    editable && !["space", "fee", "tax", "credit"].includes(kindOf(l)) && l.by !== "platform" && l.reversedBy == null && l.reversalOf == null;

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (r.ok) { setMsg({ kind: "ok", text: done }); setConfirmIdx(null); setReason(""); setPick(false); setChoice(""); setQty(1); router.refresh(); }
      else setMsg({ kind: "err", text: r.error });
    });
  }

  const chosen = catalog.find((a) => a.name === choice);
  const chosenPrice = Number(chosen?.price ?? 0);

  return (
    <div className="tcard bkd-card bill">
      <div className="bill-head">
        <h3>Bill</h3>
        {state && <span className={`bill-state ${state.cls}`}>{state.label}</span>}
      </div>

      {items.length === 0 ? <p className="muted" style={{ margin: 0 }}>No lines yet.</p> : (
        <div className="bill-lines">
          {items.map((l, i) => {
            const kind = kindOf(l);
            const amt = Number(l.amount ?? l.subtotal ?? 0);
            const struck = l.reversedBy != null;
            const isReversal = l.reversalOf != null;
            const title = l.label || l.listingTitle || l.code || KIND_LABEL[kind] || "Line";
            const q = Number(l.quantity ?? l.meta?.quantity ?? 1);
            return (
              <div className={`bill-line${struck ? " struck" : ""}${isReversal ? " reversal" : ""}`} key={i}>
                <div className="bill-main">
                  <span className="bill-title">{title}{q > 1 && kind === "space" ? ` ×${q}` : ""}</span>
                  <span className="bill-kind">{KIND_LABEL[kind] || kind}{l.by === "platform" ? " · platform" : ""}{struck ? " · reversed" : ""}</span>
                </div>
                <div className="bill-right">
                  <b className={`bill-amt${amt < 0 ? " neg" : ""}`}>{amt === 0 ? "Free" : `${amt < 0 ? "−" : ""}${money(Math.abs(amt))}`}</b>
                  {reversible(l) && (
                    <button type="button" className="bill-undo" title="Reverse this line" aria-label={`Reverse ${title}`} disabled={pending} onClick={() => { setConfirmIdx(confirmIdx === i ? null : i); setMsg(null); }}>↶</button>
                  )}
                </div>
                {confirmIdx === i && (
                  <div className="bill-confirm">
                    <p>Reverse <b>{title}</b>{amt ? <> ({money(Math.abs(amt))})</> : null}? The line stays on the bill with its reversal underneath{amt > 0 ? "; if the guest already paid, the difference goes back to their card" : ""}.</p>
                    <input className="ht-input" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
                    <div className="ht-form-row">
                      <button type="button" className="ht-btn primary" disabled={pending} onClick={() => run(() => reverseLineAction(bookingId, i, reason || undefined), "Line reversed.")}>{pending ? "Working…" : "Reverse line"}</button>
                      <button type="button" className="ht-btn ghost" disabled={pending} onClick={() => setConfirmIdx(null)}>Keep it</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="bkd-totals">
        <div className="bkd-trow bkd-total"><span>Total</span><b>{money(total)}</b></div>
        {due && due.paid > 0 ? <div className="bkd-trow"><span>Paid so far</span><b>{money(due.paid)}</b></div> : null}
        {due && due.accrued > 0 ? <div className="bkd-trow"><span>On the meter (not yet billed)</span><b>{money(due.accrued)}</b></div> : null}
        {due ? <div className="bkd-trow"><span>Balance due</span><b className={due.due > 0 ? "bill-due" : ""}>{money(due.due)}</b></div> : null}
      </div>

      {/* Collect what's owed — pre-fills the take-payment sheet with this booking + its balance,
          so the host never retypes an amount (and can't ask twice once it reads $0). */}
      {editable && due && due.due > 0 && (
        <Link className="btn clay bill-take" href={`${routes.hostPayments}?booking=${encodeURIComponent(bookingId)}&amount=${due.due.toFixed(2)}${reference ? `&ref=${encodeURIComponent(reference)}` : ""}`}>
          Take payment · {money(due.due)}
        </Link>
      )}
      {editable && due && due.due <= 0 && due.paid > 0 && <div className="bill-settled">Paid — nothing due</div>}

      {editable && catalog.length > 0 && (
        pick ? (
          <div className="bill-add">
            <label className="set-field"><span>Add-on</span>
              <select value={choice} onChange={(e) => setChoice(e.target.value)}>
                <option value="">Choose…</option>
                {catalog.map((a) => <option key={a.name} value={a.name}>{a.title || a.label || a.name} — {Number(a.price ?? 0) > 0 ? `${money(Number(a.price))}${a.chargeEvery && a.chargeEvery !== "once" ? ` / ${a.chargeEvery}` : ""}` : "free"}{a.service ? " · you do this" : ""}</option>)}
              </select></label>
            {chosen && chosenPrice > 0 && (chosen.chargeEvery === "item" || chosen.chargeEvery === "day" || chosen.chargeEvery === "hour" || chosen.chargeEvery === "week" || chosen.chargeEvery === "month") && (
              <label className="set-field"><span>Quantity <em>({chosen.chargeEvery}s)</em></span>
                <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} /></label>
            )}
            <div className="ht-form-row">
              <button type="button" className="ht-btn primary" disabled={pending || !chosen} onClick={() => chosen && run(() => addCatalogAddonAction(bookingId, { code: chosen.name, label: chosen.title || chosen.label || chosen.name, amount: chosenPrice, quantity: qty }), chosen.service ? "Add-on added — it’s in your request queue." : "Add-on added to the bill.")}>
                {pending ? "Adding…" : chosen ? `Add ${chosenPrice > 0 ? money(chosenPrice * qty) : "free add-on"}` : "Add"}
              </button>
              <button type="button" className="ht-btn ghost" disabled={pending} onClick={() => { setPick(false); setChoice(""); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" className="ht-link bill-addbtn" onClick={() => { setPick(true); setMsg(null); }}>+ Add add-on</button>
        )
      )}

      {msg && <div className={msg.kind === "ok" ? "ht-ok" : "bp-error"} style={{ marginTop: 10 }}>{msg.kind === "ok" ? "✓ " : ""}{msg.text}</div>}
    </div>
  );
}
