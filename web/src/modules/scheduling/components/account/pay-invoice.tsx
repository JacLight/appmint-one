"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PaymentStep } from "@/modules/rentals/components/listing/payment-step";
import { confirmCard } from "@/modules/logistics/components/shared/confirm-card";
import { invoiceConfirmAction, invoiceIntentAction } from "../../actions/booking";
import { money } from "../../lib/format";

/** Pay an invoice. The button shows the balance the engine sent; the engine opens the
 *  intent for what it says is owed (client-data/pay/:id/intent), and if that differs from
 *  what the page showed the payment stops so the customer can see the new figure. */
export function PayInvoice({ id, balance, currency }: { id: string; balance: number; currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <span className="sc-pill">Paid</span>;
  if (!open) return <button type="button" className="btn clay sm" onClick={() => setOpen(true)}>Pay {money(balance, currency)}</button>;
  return (
    <div className="ac-paybox">
      {err && <p className="bk-err" style={{ marginBottom: 10 }}>{err}</p>}
      <PaymentStep label={`Pay ${money(balance, currency)}`} busy={pending} onPay={(pm) => start(async () => {
        setErr(null);
        const r = await invoiceIntentAction(id);
        if (!r.ok) { setErr(r.error); return; }
        if ("settled" in r) { setDone(true); router.refresh(); return; }
        if (Math.abs(r.amount - balance) > 0.004) { setErr(`This invoice now comes to ${money(r.amount, r.currency)}. Refresh to see it before paying.`); return; }
        const c = await confirmCard(r.clientSecret, pm);
        if (!c.ok) { setErr(c.error); return; }
        const d = await invoiceConfirmAction(id, c.paymentIntentId);
        if (!d.ok) { setErr(d.error); return; }
        setDone(true);
        router.refresh();
      })} />
    </div>
  );
}
