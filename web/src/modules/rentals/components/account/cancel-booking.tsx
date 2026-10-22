"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelMyBookingAction, cancelPreviewAction } from "@/modules/rentals/actions/booking";
import { formatMoney } from "@/lib/utils";
import type { BookingDue } from "@/api/rentals";

/** Cancel a booking — but first ask the server what that means in money (refund, any
 *  cancellation fee, anything still due) and show it. The cancel writes those same
 *  numbers, so what the guest confirms is what happens. */
export function CancelBooking({ bookingId, refundNote, currency = "USD" }: { bookingId: string; refundNote?: string; currency?: string }) {
  const router = useRouter();
  const [preview, setPreview] = useState<BookingDue | null | "loading">(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const money = (n?: number) => formatMoney(Math.round((n ?? 0) * 100), currency);

  function open() {
    setError(null); setPreview("loading");
    start(async () => {
      const r = await cancelPreviewAction(bookingId);
      if (r.ok) setPreview(r.due);
      else { setPreview(null); setError(r.error); }
    });
  }
  function cancel() {
    setError(null);
    start(async () => {
      const res = await cancelMyBookingAction(bookingId);
      if (res.ok) { setPreview(null); router.refresh(); }
      else setError(res.error);
    });
  }

  if (!preview) {
    return (
      <div className="bkd-cancel">
        <button type="button" className="bkd-cancel-btn" onClick={open}>Cancel this booking</button>
        {error && <div className="bp-error" style={{ marginTop: 8 }}>{error}</div>}
      </div>
    );
  }
  if (preview === "loading") return <div className="bkd-cancel confirming"><p className="bkd-cancel-q muted">Working out your refund…</p></div>;

  const fees = (preview.lines ?? []).filter((l) => (l.kind === "fee" || l.kind === "charge") && Number(l.amount) > 0);
  const refund = Number(preview.refund ?? 0), due = Number(preview.due ?? 0), paid = Number(preview.paid ?? 0);
  return (
    <div className="bkd-cancel confirming">
      <p className="bkd-cancel-q">Cancel this booking?</p>
      <div className="cx-sum">
        {paid > 0 && <div className="cx-row"><span>You paid</span><b>{money(paid)}</b></div>}
        {fees.map((f, i) => <div className="cx-row" key={i}><span>{f.label}</span><b>−{money(Math.abs(Number(f.amount)))}</b></div>)}
        {refund > 0 && <div className="cx-row cx-refund"><span>Refund to your card</span><b>{money(refund)}</b></div>}
        {due > 0 && <div className="cx-row cx-due"><span>Still due</span><b>{money(due)}</b></div>}
        {preview.message && <p className="cx-msg">{preview.message}</p>}
        {!preview.message && refundNote && <p className="cx-msg">{refundNote}</p>}
      </div>
      {error && <div className="bp-error" style={{ marginBottom: 8 }}>{error}</div>}
      <div className="bkd-cancel-row">
        <button type="button" className="btn danger" onClick={cancel} disabled={pending}>
          {pending ? "Cancelling…" : refund > 0 ? `Cancel — refund ${money(refund)}` : due > 0 ? `Cancel — ${money(due)} due` : "Yes, cancel booking"}
        </button>
        <button type="button" className="btn ghost" onClick={() => setPreview(null)} disabled={pending}>Keep it</button>
      </div>
    </div>
  );
}
