"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PaymentStep } from "@/modules/rentals/components/listing/payment-step";
import { payExistingAction, completePaymentAction } from "@/modules/logistics/actions/customer";
import { confirmCard } from "@/modules/logistics/components/shared/confirm-card";
import { money } from "@/modules/logistics/components/shared/bits";

/** An order that was created but never paid: pay its own price to release it. */
export function FinishPayment({ jobId, amount, currency, jobWord }: { jobId: string; amount: number; currency: string; jobWord: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open) return <button type="button" className="mv-btn" onClick={() => setOpen(true)}>Pay {money(amount, currency)} to book</button>;
  return (
    <div>
      {err && <div className="lg-err" style={{ marginBottom: 8 }}>{err}</div>}
      <PaymentStep label={`Pay ${money(amount, currency)}`} busy={pending} onPay={(pm) => start(async () => {
        setErr(null);
        const r = await payExistingAction(jobId);
        if (!r.ok) { setErr(r.error); return; }
        if (Math.abs(r.amount - amount) > 0.004) { setErr(`The price for this ${jobWord.toLowerCase()} is ${money(r.amount, currency)}. Refresh to pay that amount.`); return; }
        const c = await confirmCard(r.clientSecret, pm);
        if (!c.ok) { setErr(c.error); return; }
        const d = await completePaymentAction(jobId, c.paymentIntentId);
        if (!d.ok) { setErr(d.error); return; }
        router.refresh();
      })} />
    </div>
  );
}
