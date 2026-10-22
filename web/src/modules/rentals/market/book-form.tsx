"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PaymentStep } from "@/modules/rentals/components/listing/payment-step";
import { abandonCheckoutAction, confirmAction, holdAction, pendingHoldAction } from "@/modules/rentals/actions/checkout";
import { messageHostAction } from "./actions";
import type { Guests } from "./search-bar";
import { money } from "./shared";

/** Message to the host + card → the server holds the dates, charges, and confirms. */
export function BookForm({ listingId, startDate, endDate, guests, hostFirst, actionLabel, testMode, total, deposit = 0 }: {
  listingId: string; startDate: string; endDate: string; guests?: Guests; hostFirst: string;
  actionLabel: string; testMode: boolean; total: number; deposit?: number;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expect, setExpect] = useState(total);
  const [expectDeposit, setExpectDeposit] = useState(deposit);
  const [due, setDue] = useState<{ now: number; upfront?: number; deposit?: number; currency?: string } | null>(null);

  /** Stowbo's checkout, step for step: HOLD the dates (holdAction), check today's charge
   *  is the one on screen, then PAY & CONFIRM (confirmAction). A stale hold from an
   *  earlier try is released first (pendingHoldAction → abandonCheckoutAction). */
  async function pay(paymentMethodId: string) {
    setBusy(true); setErr(null);
    const items = [{ listing: listingId, startDate, endDate, quantity: 1 }];
    let hold = await holdAction(items);
    if (!hold.ok && /hold/i.test(`${hold.code} ${hold.error}`)) {
      const live = await pendingHoldAction();
      if (live) { await abandonCheckoutAction(live.checkoutId); hold = await holdAction(items); }
    }
    if (!hold.ok) { setBusy(false); setErr(hold.error || "Those dates were just taken. Try different dates."); return; }
    const off = (a: unknown, b: number) => Math.abs(Number(a) - b) > 0.005;
    const mismatch = hold.dueNow != null && (hold.dueUpfront != null && hold.dueDeposit != null
      ? off(hold.dueUpfront, expect) || off(hold.dueDeposit, expectDeposit)
      : off(hold.dueNow, expect + expectDeposit));
    if (mismatch) {
      await abandonCheckoutAction(hold.checkoutId);
      setBusy(false);
      const d = { now: Number(hold.dueNow), upfront: hold.dueUpfront, deposit: hold.dueDeposit, currency: hold.currency };
      setDue(d); setExpect(d.upfront ?? d.now); setExpectDeposit(d.upfront != null ? d.deposit ?? 0 : 0);
      return;
    }
    const done = await confirmAction(hold.checkoutId, paymentMethodId);
    if (!done.ok) { setBusy(false); setErr(done.error || "Your card was not charged. Please try another card."); return; }
    // First message to the host — with who is coming.
    const g = guests;
    const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;
    const who = g ? [n(g.adults + g.children, "guest"), g.infants ? n(g.infants, "infant") : "", g.pets ? n(g.pets, "pet") : ""].filter(Boolean).join(", ") : "";
    const text = msg.trim();
    if (text || who) await messageHostAction(done.reference, text ? (who ? `${text}\n\n(${who})` : text) : `Booked for ${who}.`).catch(() => null);
    router.push(`/account/bookings/${encodeURIComponent(done.reference)}?booked=1`);
  }

  return (
    <>
      <section>
        <h2>Message {hostFirst}</h2>
        <p className="mk-muted" style={{ marginBottom: 12, fontSize: 15 }}>
          {`Say hello and share anything ${hostFirst} should know before you arrive.`}
        </p>
        <textarea className="mk-ta" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={`Hi ${hostFirst}! We're coming for…`} maxLength={1500} />
      </section>
      <section>
        <h2>Pay with card</h2>
        {testMode && <p className="mk-testcard">Test mode — no real card is charged. Use 4242 4242 4242 4242, any future date and any CVC.</p>}
        {err && <p className="mk-err" style={{ marginBottom: 12 }}>{err}</p>}
        {due && (
          <div className="mk-box" style={{ marginBottom: 14 }}>
            <h3>Today&apos;s charge: {money(due.now, due.currency)}</h3>
            {due.deposit ? <p className="mk-muted" style={{ fontSize: 14.5 }}>{due.upfront != null ? `${money(due.upfront, due.currency)} for the booking and a ` : "Includes a "}{money(due.deposit, due.currency)} refundable deposit. Pay again below to confirm.</p>
              : <p className="mk-muted" style={{ fontSize: 14.5 }}>The price changed since you opened this page. Pay again below to confirm.</p>}
          </div>
        )}
        <div className="mk-pay">
          <PaymentStep label={actionLabel} onPay={pay} busy={busy} />
        </div>
        <p className="mk-muted" style={{ fontSize: 13, marginTop: 14 }}>
          By selecting the button, you agree to the house rules and the cancellation policy above.
        </p>
      </section>
    </>
  );
}
