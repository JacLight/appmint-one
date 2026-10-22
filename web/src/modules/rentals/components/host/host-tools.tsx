"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/utils";
import { settleAction, chargeGuestAction, refundGuestAction, cancelBookingAction, hostDuePreviewAction } from "@/modules/rentals/actions/host";
import type { BookingDue } from "@/api/rentals";

/** Host money + management tools for one booking — the extra reach the host has
 *  over a booking that the guest does not: settle & pay out, add a charge
 *  (damage / extra time), refund, or cancel. */
export function HostTools({ bookingId, canSettle }: { bookingId: string; canSettle: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [mode, setMode] = useState<"none" | "charge" | "refund" | "cancel">("none");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  // Cancel vs no-show: the server says what each does to the money before the button.
  const [how, setHow] = useState<"cancel" | "no_show">("cancel");
  const [preview, setPreview] = useState<Record<string, BookingDue | null>>({});
  const money = (n?: number) => formatMoney(Math.round((n ?? 0) * 100), "USD");
  function openCancel() {
    setMode("cancel"); setOk(null); setHow("cancel");
    start(async () => {
      const [c, n] = await Promise.all([hostDuePreviewAction(bookingId, "cancel"), hostDuePreviewAction(bookingId, "no_show")]);
      setPreview({ cancel: c.ok ? c.due : null, no_show: n.ok ? n.due : null });
    });
  }

  const run = (fn: () => Promise<any>, done: string) => {
    setErr(null); setOk(null);
    start(async () => {
      const r = await fn();
      if (r && r.ok === false) setErr(r.error || "Couldn’t do that.");
      else { setOk(done); setMode("none"); setAmount(""); setReason(""); router.refresh(); }
    });
  };
  const amt = Number(amount);
  const amtValid = amount !== "" && !Number.isNaN(amt) && amt > 0;

  return (
    <div className="tcard ht">
      <h3>Host tools</h3>

      {canSettle && (
        <button type="button" className="ht-btn primary" onClick={() => run(() => settleAction(bookingId), "Settled & paid out.")} disabled={pending}>
          {pending ? "Working…" : "Settle & pay out"}
        </button>
      )}

      {mode === "none" ? (
        <div className="ht-row">
          <button type="button" className="ht-link" onClick={() => { setMode("charge"); setOk(null); }}>Add a charge</button>
          <button type="button" className="ht-link" onClick={() => { setMode("refund"); setOk(null); }}>Refund</button>
          <button type="button" className="ht-link danger" onClick={openCancel}>Cancel booking</button>
        </div>
      ) : mode === "cancel" ? (
        <div className="ht-form">
          <div className="ht-seg">
            <button type="button" className={how === "cancel" ? "on" : ""} onClick={() => setHow("cancel")}>Cancel</button>
            <button type="button" className={how === "no_show" ? "on" : ""} onClick={() => setHow("no_show")}>No-show</button>
          </div>
          {(() => {
            const p = preview[how];
            if (p === undefined) return <p className="ht-q muted">Checking the money…</p>;
            if (p === null) return <p className="ht-q">{how === "no_show" ? "Mark as a no-show — the space is freed and no-show fees apply." : "Cancel this booking — the space is freed and any refund follows the policy."}</p>;
            const fees = (p.lines ?? []).filter((l) => (l.kind === "fee" || l.kind === "charge") && Number(l.amount) > 0);
            return (
              <div className="cx-sum">
                {p.paid > 0 && <div className="cx-row"><span>Guest paid</span><b>{money(p.paid)}</b></div>}
                {fees.map((f, i) => <div className="cx-row" key={i}><span>{f.label}</span><b>{money(Math.abs(Number(f.amount)))}</b></div>)}
                {Number(p.refund) > 0 && <div className="cx-row cx-refund"><span>Refund to guest</span><b>{money(p.refund)}</b></div>}
                {Number(p.due) > 0 && <div className="cx-row cx-due"><span>Guest still owes</span><b>{money(p.due)}</b></div>}
                {p.message && <p className="cx-msg">{p.message}</p>}
              </div>
            );
          })()}
          <input className="ht-input" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="ht-form-row">
            <button type="button" className="ht-btn danger" onClick={() => run(() => cancelBookingAction(bookingId, reason || undefined, { noShow: how === "no_show" }), how === "no_show" ? "Marked as no-show." : "Booking cancelled.")} disabled={pending}>
              {how === "no_show" ? "Mark no-show" : "Yes, cancel"}{(() => { const p = preview[how]; return p && Number(p.refund) > 0 ? ` — refund ${money(p.refund)}` : p && Number(p.due) > 0 ? ` — ${money(p.due)} due` : ""; })()}
            </button>
            <button type="button" className="ht-btn ghost" onClick={() => setMode("none")} disabled={pending}>Keep it</button>
          </div>
        </div>
      ) : (
        <div className="ht-form">
          <p className="ht-q">{mode === "charge" ? "Charge the guest (damage, extra time, add-on):" : "Refund the guest:"}</p>
          <div className="ht-amt"><span>$</span><input className="ht-input" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} /></div>
          <input className="ht-input" placeholder={mode === "charge" ? "What for? (e.g. damage)" : "Reason"} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="ht-form-row">
            <button type="button" className="ht-btn primary" disabled={pending || !amtValid}
              onClick={() => run(() => mode === "charge"
                ? chargeGuestAction(bookingId, { amount: amt, description: reason || undefined })
                : refundGuestAction(bookingId, { amount: amt, description: reason || undefined }), mode === "charge" ? `Charged $${amt.toFixed(2)}.` : `Refunded $${amt.toFixed(2)}.`)}>
              {mode === "charge" ? "Charge" : "Refund"}
            </button>
            <button type="button" className="ht-btn ghost" onClick={() => setMode("none")} disabled={pending}>Cancel</button>
          </div>
        </div>
      )}

      {ok && <div className="ht-ok">✓ {ok}</div>}
      {err && <div className="bp-error" style={{ marginTop: 8 }}>{err}</div>}
    </div>
  );
}
