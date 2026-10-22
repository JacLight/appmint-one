import { SiteHeader } from "@/components/site-header";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireHost } from "@/lib/guards";
import { getNav } from "@/lib/nav-server";
import { stowbo, type HostPayment } from "@/api/rentals";
import { formatMoney } from "@/lib/utils";
import { TakePayment } from "@/modules/rentals/components/host/take-payment";
import { PaymentRow } from "@/modules/rentals/components/host/payment-row";

export const metadata = { title: "Payments" };

/** A PENDING row has no `ref` — that field holds the gateway transaction id and is only
 *  set once the payment settles. Keying on it collided every pending row on `undefined`,
 *  so fall back to the pay url, then to the row's own details. */
function rowKey(r: HostPayment, i: number) {
  return r.ref || r.url || `${r.at ?? ""}-${r.amount}-${r.description ?? r.reference ?? ""}-${i}`;
}

export default async function HostPaymentsPage({ searchParams }: { searchParams: Promise<{ booking?: string; amount?: string; ref?: string; what?: string }> }) {
  await requireHost();
  const sp = await searchParams;
  // Arriving from a booking's "Take payment · $X" — pre-fill the sheet with that booking.
  const preset = sp.booking ? { bookingId: sp.booking, amount: sp.amount ? Number(sp.amount) : undefined, reference: sp.ref, description: sp.what, category: "booking" as const } : undefined;
  const rows: HostPayment[] = await stowbo.host.transactions().then(
    (r) => (Array.isArray(r) ? r : []),
    () => [],
  );
  const pending = rows.filter((r) => r.pending);
  const settled = rows.filter((r) => !r.pending && r.status !== "cancelled");
  const refunds = settled.filter((r) => r.kind === "refund");
  const charges = settled.filter((r) => r.kind !== "refund");
  const cur = rows[0]?.currency || "USD";
  // Collected is NET — a refund row is money out, so it comes off, never on.
  const collected = charges.reduce((s, r) => s + Number(r.amount || 0), 0) - refunds.reduce((s, r) => s + Number(r.amount || 0), 0);
  const refunded = refunds.reduce((s, r) => s + Number(r.amount || 0), 0);
  const waiting = pending.reduce((s, r) => s + Number(r.amount || 0), 0);
  const money = (n: number, c = cur) => formatMoney(Math.round((n ?? 0) * 100), c);

  return (
    <>
      <SiteHeader />
      <DashboardShell nav={(await getNav()).provider} title="Payments">
        <div className="hp-grid">
          <div className="hp-main">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 22 }}>
              <div className="tcard"><p className="eyebrow">Collected</p><div className="hp-stat">{money(collected)}</div><p className="muted" style={{ fontSize: 13 }}>{charges.length} payment{charges.length === 1 ? "" : "s"}{refunded > 0 ? ` · net of ${money(refunded)} refunded` : ""}</p></div>
              <div className="tcard"><p className="eyebrow">Awaiting payment</p><div className="hp-stat">{money(waiting)}</div><p className="muted" style={{ fontSize: 13 }}>{pending.length} open request{pending.length === 1 ? "" : "s"}</p></div>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "-8px 0 18px" }}>Tap any row for the details — who paid, what for, the gateway reference — and to refund, resend a receipt or cancel a waiting link.</p>

            {pending.length > 0 && (
              <>
                <h2 className="hp-h">Waiting to be paid</h2>
                <div className="hp-list" style={{ marginBottom: 26 }}>
                  {pending.map((r, i) => <PaymentRow key={rowKey(r, i)} r={r} cur={cur} />)}
                </div>
              </>
            )}

            <h2 className="hp-h">Transactions</h2>
            {settled.length === 0 && rows.filter((r) => r.status === "cancelled").length === 0 ? (
              <div className="tcard" style={{ textAlign: "center", padding: "30px 20px" }}>
                <p className="muted" style={{ margin: 0 }}>Nothing collected yet. Take a payment on the right and it lands here.</p>
              </div>
            ) : (
              <div className="hp-list">
                {rows.filter((r) => !r.pending).map((r, i) => <PaymentRow key={rowKey(r, i)} r={r} cur={cur} />)}
              </div>
            )}
          </div>

          <aside className="hp-side"><TakePayment preset={preset} /></aside>
        </div>
      </DashboardShell>
    </>
  );
}
