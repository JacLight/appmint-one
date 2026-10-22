"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PaymentStep } from "@/modules/rentals/components/listing/payment-step";
import { confirmCard } from "@/modules/logistics/components/shared/confirm-card";
import { buyPlanAction } from "../../actions/booking";

/** Card step for a pack or membership. The amount on the button is the plan's price from
 *  the engine; the engine charges it from the plan, never from this page. */
export function BuyPlan({ plan, label, next }: { plan: string; label: string; next?: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const go = next && next.startsWith("/") && !next.startsWith("//") ? next : "/account/scheduling?bought=1";

  if (done) return <div className="bk-ok" role="status"><b>You&rsquo;re all set.</b> Taking you back…</div>;
  return (
    <div>
      {err && <div className="bk-err" role="alert" style={{ marginBottom: 12 }}>{err}</div>}
      <PaymentStep label={label} busy={pending} onPay={(pm) => start(async () => {
        setErr(null);
        const r = await buyPlanAction(plan, pm);
        if (!r.ok) { if (r.signIn) { router.push(`/login?next=${encodeURIComponent(location.pathname + location.search)}`); return; } setErr(r.error); return; }
        if (r.clientSecret) {
          const c = await confirmCard(r.clientSecret, pm);
          if (!c.ok) { setErr(c.error); return; }
        }
        setDone(true);
        router.push(go);
        router.refresh();
      })} />
    </div>
  );
}
