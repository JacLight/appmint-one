import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireHost } from "@/lib/guards";
import { routes } from "@/lib/nav";
import { getNav } from "@/lib/nav-server";
import { stowbo, type Earnings, type HostWallet, type HostPayout, type HostPayoutMethod } from "@/api/rentals";
import { finance, type WalletBundle } from "@/lib/finance";
import { PayoutMethods } from "@/modules/rentals/components/host/payout-methods";
import { formatMoney } from "@/lib/utils";
import { fmtFull } from "@/lib/dates";
import { CashOut } from "@/modules/rentals/components/account/cash-out";

export const metadata = { title: "Earnings" };

const PAYOUT_STATE: Record<string, string> = { requested: "Pending", pending: "Pending", processing: "Processing", paid: "Paid", completed: "Paid", failed: "Failed", cancelled: "Cancelled", rejected: "Rejected" };

export default async function HostEarnings() {
  await requireHost();
  const [earnR, hwR, payoutsR, walletR, methodsR] = await Promise.allSettled([
    stowbo.host.earnings(),
    stowbo.host.wallet(),      // the HOST wallet: available, pending links, payout minimum, pipeline
    stowbo.host.payouts(),
    finance.wallet(),          // the generic ledger (credits/debits) — still the activity feed
    stowbo.host.payoutMethods(), // saved destinations, masked to last four by the server
  ]);
  // null = this backend has no payout-destination routes yet. The card stays hidden and
  // cash-out behaves as it did before, rather than holding the host behind a card they
  // cannot use (capability gate, same as delegated pickup).
  const methods = (methodsR.status === "fulfilled" && Array.isArray(methodsR.value) ? methodsR.value : null) as HostPayoutMethod[] | null;
  const earn = (earnR.status === "fulfilled" ? earnR.value : null) as Earnings | null;
  const hw = (hwR.status === "fulfilled" ? hwR.value : null) as HostWallet | null;
  const payouts = (payoutsR.status === "fulfilled" && Array.isArray(payoutsR.value) ? payoutsR.value : []) as HostPayout[];
  const wallet = (walletR.status === "fulfilled" ? walletR.value : null) as WalletBundle | null;
  const cur = hw?.currency || earn?.currency || "USD";
  const money = (n?: number) => formatMoney(Math.round((n ?? 0) * 100), cur);
  const available = hw?.available ?? wallet?.summary?.availableBalance ?? 0;
  const minimum = hw?.minPayout ?? (wallet?.wallet?.data as any)?.limits?.minimumPayout ?? 0;

  return (
    <>
      <SiteHeader />
      <DashboardShell nav={(await getNav()).provider} title="Earnings">
        <div className="tcard" style={{ background: "var(--text)", color: "#fff", marginBottom: 22 }}>
          <p className="eyebrow" style={{ color: "var(--pop)" }}>Available to cash out</p>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 42, fontWeight: 700, marginTop: 6 }}>{money(available)}</div>
          <p style={{ color: "#b7b3a6", fontSize: 13.5, marginTop: 4, marginBottom: 14 }}>
            Collected payments, net of refunds, minus what’s already been paid out{hw && hw.pendingPayout > 0 ? ` (${money(hw.pendingPayout)} payout in progress)` : ""}.
            {minimum > 0 ? ` Minimum payout ${money(minimum)}.` : ""}
          </p>
          <CashOut available={available} currency={cur} minimum={minimum} methods={methods} />
        </div>

        {methods && <div style={{ marginBottom: 22 }}><PayoutMethods methods={methods} /></div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 16, marginBottom: 28 }}>
          <div className="tcard"><p className="eyebrow">Collected</p><div className="earn-stat">{money(hw?.earned ?? earn?.settled)}</div><p className="muted" style={{ fontSize: 12.5, margin: 0 }}>net of {money(hw?.refunded)} refunded</p></div>
          <div className="tcard"><p className="eyebrow">Links waiting</p><div className="earn-stat">{money(hw?.pending)}</div><p className="muted" style={{ fontSize: 12.5, margin: 0 }}>pay links not yet paid</p></div>
          <Link href={routes.hostCustody} className="tcard earn-link"><p className="eyebrow">Expected from bookings</p><div className="earn-stat">{money(hw?.expectedFromBookings)}</div><p className="muted" style={{ fontSize: 12.5, margin: 0 }}>{hw?.pendingBookings ?? 0} unpaid booking{(hw?.pendingBookings ?? 0) === 1 ? "" : "s"} to collect →</p></Link>
          <div className="tcard"><p className="eyebrow">Paid out</p><div className="earn-stat">{money(hw?.paidOut)}</div><p className="muted" style={{ fontSize: 12.5, margin: 0 }}>{earn?.bookings ?? 0} booking{(earn?.bookings ?? 0) === 1 ? "" : "s"} settled</p></div>
        </div>

        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Payouts</h2>
        {payouts.length === 0 ? (
          <div className="tcard" style={{ textAlign: "center", padding: "26px 20px", marginBottom: 28 }}><p className="muted" style={{ margin: 0 }}>No payouts yet — cash out above when you’re ready.</p></div>
        ) : (
          <div className="ldg" style={{ marginBottom: 28 }}>
            {payouts.map((p) => (
              <div className="ldg-row" key={p.id}>
                <div className="ldg-main">
                  {/* Where it went, not just the rail: "Business checking · Test Bank · ····6789". */}
                  <b>Payout{p.number ? ` #${p.number}` : ""} · {p.destination ? [p.destination.label, p.destination.detail].filter(Boolean).join(" · ") || p.destination.type : (p.method || "destination not recorded")}</b>
                  <span className="ldg-ref">{p.at ? fmtFull(p.at) : ""}{p.traceNumber ? ` · trace ${p.traceNumber}` : ""}{p.note ? ` · ${p.note}` : ""}</span>
                  {p.failureReason && <span className="ldg-ref" style={{ color: "#a5401f" }}>Failed: {p.failureReason}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className={`hp-pill ${["paid", "completed"].includes(p.status) ? "ok" : ["failed", "cancelled", "rejected"].includes(p.status) ? "off" : "wait"}`}>{PAYOUT_STATE[p.status] || p.status}</span>
                  <span className="ldg-amt db">−{money(p.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Ledger</h2>
        {(wallet?.transactions?.length ?? 0) === 0 ? (
          <div className="tcard" style={{ textAlign: "center", padding: "34px 20px" }}><p className="muted">No activity yet — collected payments and payouts show here. Every payment you take is on <Link href={routes.hostPayments}>Payments</Link>.</p></div>
        ) : (
          <div className="ldg">
            {wallet!.transactions.map((t, i) => {
              const d: any = t.data ?? {};
              const amt = Number(d.amount ?? 0);
              const credit = amt >= 0;
              return (
                <div className="ldg-row" key={d.transactionNumber || i}>
                  <div className="ldg-main">
                    <b>{d.description || d.category || d.type || (credit ? "Credit" : "Payout")}</b>
                    {d.reference ? <span className="ldg-ref">{d.referenceType ? `${d.referenceType} · ` : ""}{d.reference}</span> : null}
                  </div>
                  <span className={`ldg-amt ${credit ? "cr" : "db"}`}>{credit ? "+" : "−"}{formatMoney(Math.abs(amt) * 100, cur)}</span>
                </div>
              );
            })}
          </div>
        )}
      </DashboardShell>
    </>
  );
}
