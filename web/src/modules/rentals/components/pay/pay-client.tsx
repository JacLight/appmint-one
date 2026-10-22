"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { payBookingAction } from "@/modules/rentals/actions/pay";
import { PaymentStep } from "@/modules/rentals/components/listing/payment-step";
import { formatMoney } from "@/lib/utils";
import { routes } from "@/lib/nav";
import type { PaymentView } from "@/api/rentals";

/** The generic take-payment screen.
 *
 *  A link carries one reference — a BOOKING id, or a `stowbo-pr-…` request raised by a
 *  host for a walk-up with no booking — plus a type and amount for display only.
 *  Everything shown here is what the SERVER says is owed, and the server charges that,
 *  never anything from the URL. No sign-in: a guest can pay. */
export function PayClient({ view, label, payRef }: { view: PaymentView; label?: string; payRef?: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<{ paid: number; balance: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // A booking id or a `stowbo-pr-…` request ref — whichever this link points at.
  // Derived here rather than imported from lib/stowbo: that module is server-only
  // (it reaches next/headers), and importing a runtime value from it into a client
  // component drags the whole server chain into the browser bundle and breaks the build.
  // The ref that resolves this link is the one the page opened it with — the `?t=` token
  // (or `?id=` booking). It's what GET /pay/<ref> already succeeded on, so POST /pay/<ref>
  // resolves the same row. `view.booking/request` are display fields and are empty for an
  // ad-hoc token request — falling back to them is what produced the empty-path 404.
  const ref = String(payRef || view.booking || view.request || "");
  const money = (n: number) => formatMoney(Math.round((n ?? 0) * 100), view.currency);

  function pay(paymentMethodId: string) {
    setErr(null);
    start(async () => {
      const r = await payBookingAction(ref, paymentMethodId);
      if (r.ok) { setDone({ paid: r.paid, balance: r.balance }); return; }
      setErr(r.message);
    });
  }

  if (done) {
    return (
      <div className="pay-card pay-done">
        <div className="pay-tick" aria-hidden>✓</div>
        <h1>Payment received</h1>
        <p className="pay-lead">We charged <b>{money(done.paid)}</b>{view.venue ? <> for your booking at <b>{view.venue}</b></> : null}.</p>
        {done.balance > 0
          ? <p className="pay-note">A balance of <b>{money(done.balance)}</b> is still outstanding.</p>
          : <p className="pay-note">{view.booking
              ? "This booking is paid in full."
              : "This payment request is paid. Your host can confirm any remaining booking balance."}</p>}
        {view.reference && <p className="pay-ref">Reference <b>#{view.reference}</b></p>}
        {view.booking && <Link className="btn clay" href={routes.account + "/bookings"} style={{ marginTop: 14 }}>View my bookings</Link>}
        <p className="pay-small">No account? Keep this reference — your host can find the payment with it.</p>
      </div>
    );
  }

  if (view.cancelled) {
    return (
      <div className="pay-card">
        <h1>This booking was cancelled</h1>
        <p className="pay-lead">There’s nothing to pay. If you think that’s wrong, contact your host.</p>
      </div>
    );
  }

  if (!(view.balance > 0)) {
    return (
      <div className="pay-card pay-done">
        <div className="pay-tick" aria-hidden>✓</div>
        {/* "Nothing to pay" reads as a shrug — someone arriving on a paid link wants to
            be TOLD they already paid, not left to infer it. */}
        <h1>You already paid</h1>
        <p className="pay-lead">
          {view.booking
            ? <>This booking is settled in full{view.venue ? <> at <b>{view.venue}</b></> : null} — nothing more is owed.</>
            : <>This payment request is settled{view.total > 0 ? <> — <b>{money(view.total)}</b> received</> : null}. Your host can confirm any remaining booking balance.</>}
        </p>
        {view.reference && <p className="pay-ref">Reference <b>#{view.reference}</b></p>}
      </div>
    );
  }

  return (
    <div className="pay-card">
      <p className="eyebrow">{label || "Payment"}</p>
      <h1>{money(view.balance)} due</h1>
      <p className="pay-lead">
        {view.venue ? <>For your booking at <b>{view.venue}</b>.</> : view.booking ? "For your booking." : "Requested by your host."}
        {view.reference ? <> Reference <b>#{view.reference}</b>.</> : null}
      </p>

      {view.lines.length > 0 && (
        <div className="pay-lines">
          {view.lines.map((l, i) => (
            <div className="pay-line" key={i}><span>{l.label}</span><b>{money(l.amount)}</b></div>
          ))}
          <div className="pay-line pay-sum"><span>Total</span><b>{money(view.total)}</b></div>
          {view.paid > 0 && <div className="pay-line"><span>Already paid</span><b>−{money(view.paid)}</b></div>}
          <div className="pay-line pay-due"><span>Due now</span><b>{money(view.balance)}</b></div>
        </div>
      )}

      {err && <div className="bp-error" style={{ marginBottom: 10 }}>{err}</div>}

      <PaymentStep label={`Pay ${money(view.balance)}`} onPay={pay} busy={pending} />
      <p className="pay-small">You don’t need an account to pay. Your card is handled by Stripe — we never see it.</p>
    </div>
  );
}
