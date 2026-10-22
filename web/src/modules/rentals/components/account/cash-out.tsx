"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestHostPayoutAction } from "@/modules/rentals/actions/host-wallet";
import { formatMoney } from "@/lib/utils";
import type { HostPayoutMethod as PayoutMethod } from "@/api/rentals";
import { methodLabel } from "@/modules/rentals/components/host/payout-methods";

/** Cash-out control on the earnings balance. Requests a payout of the available
 *  balance through the HOST route, which enforces the payout minimum (platform floor
 *  or the host's own). With more than one saved destination the host picks which;
 *  with none, it says so instead of failing on the server.
 *
 *  `methods` of null means this backend has no payout-destination routes: no picker,
 *  no "add one first" hold — just the button, as before. */
export function CashOut({ available, currency = "USD", minimum = 0, methods = null }: { available: number; currency?: string; minimum?: number; methods?: PayoutMethod[] | null }) {
  const known = methods ?? [];
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const def = known.find((m) => m.isDefault) || known[0];
  const [methodId, setMethodId] = useState<string>(def?.id || "");

  // Without destination support, the old rule stands: enough money and over the minimum.
  const canCashOut = available > 0 && available >= (minimum || 0) && (methods === null || known.length > 0);

  function go() {
    setMsg(null);
    start(async () => {
      const chosen = known.find((m) => m.id === methodId) || def;
      const r = await requestHostPayoutAction(available, undefined, chosen?.id);
      if (r.ok) { setMsg({ kind: "ok", text: `Payout requested to ${chosen ? methodLabel(chosen) : "your default destination"} — it'll show below.` }); router.refresh(); }
      else setMsg({ kind: "err", text: r.error });
    });
  }

  return (
    <div className="cashout">
      <div className="cashout-row">
        <button type="button" className="btn lime" disabled={pending || !canCashOut} onClick={go}>
          {pending ? "Requesting…" : `Cash out ${formatMoney(available * 100, currency)}`}
        </button>
        {known.length > 1 && (
          <label className="cashout-to">to
            <select value={methodId} onChange={(e) => setMethodId(e.target.value)}>
              {known.map((m) => <option key={m.id} value={m.id}>{m.label ? `${m.label} — ` : ""}{methodLabel(m)}{m.isDefault ? " (default)" : ""}</option>)}
            </select>
          </label>
        )}
        {known.length === 1 && def && <span className="cashout-to">to {def.label ? `${def.label} — ` : ""}{methodLabel(def)}</span>}
      </div>
      {methods !== null && known.length === 0 && <span className="cashout-note">Add a bank account or PayPal below first — payouts need somewhere to go.</span>}
      {(methods === null || known.length > 0) && !canCashOut && minimum > 0 && available < minimum && (
        <span className="cashout-note">Minimum payout is {formatMoney(Math.round(minimum * 100), currency)} — {formatMoney(Math.round(Math.max(0, minimum - available) * 100), currency)} more to go.</span>
      )}
      {msg && <div className={msg.kind === "ok" ? "cashout-ok" : "cashout-err"}>{msg.text}</div>}
    </div>
  );
}
