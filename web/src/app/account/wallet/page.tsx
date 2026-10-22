import { PageTitle } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/empty-state";
import { requireSession } from "@/lib/guards";
import { getSetup } from "@/lib/setup";
import { term } from "@/setups/modules";
import { finance, type WalletBundle } from "@/lib/finance";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Wallet" };

export default async function WalletPage() {
  await requireSession();
  const provider = term(await getSetup(), "provider").toLowerCase();
  const wallet = (await finance.wallet().catch(() => null)) as WalletBundle | null;
  const cur = wallet?.wallet?.data?.currency || "USD";
  const txns = wallet?.transactions ?? [];

  return (
    <>
      <PageTitle title="Wallet" />
        <div className="tcard" style={{ background: "var(--text)", color: "#fff", marginBottom: 24 }}>
          <p className="eyebrow" style={{ color: "var(--pop)" }}>Available balance</p>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 700, marginTop: 6 }}>{formatMoney((wallet?.summary?.availableBalance ?? 0) * 100, cur)}</div>
          <p style={{ color: "#b7b3a6", fontSize: 13.5, marginTop: 4 }}>
            {wallet ? `Pending ${formatMoney((wallet.summary?.pendingBalance ?? 0) * 100, cur)}` : `Your wallet activates on your first credit — ${provider} earnings land here.`}
          </p>
        </div>

        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Transactions</h2>
        {txns.length === 0 ? (
          <EmptyState title="No transactions yet" note={`Wallet activity — ${provider} earnings, payouts, refunds — will appear here.`} />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {txns.map((t, i) => (
              <div key={i} className="tcard" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                <div>
                  <b style={{ fontFamily: "var(--font-display)" }}>{t.data?.description || t.data?.type || "Transaction"}</b>
                  <div className="muted" style={{ fontSize: 13 }}>{t.data?.transactionNumber}</div>
                </div>
                <b style={{ fontFamily: "var(--font-display)", color: (t.data?.amount ?? 0) >= 0 ? "var(--accent)" : "var(--primary-strong)" }}>
                  {formatMoney((t.data?.amount ?? 0) * 100, cur)}
                </b>
              </div>
            ))}
          </div>
        )}
    </>
  );
}
