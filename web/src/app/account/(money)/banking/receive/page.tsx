import type { Metadata } from "next";
import Link from "next/link";
import { bankingMode, load } from "@/modules/money/api/adapter";
import { BankHead, ErrorPanel } from "@/modules/money/components/bits";
import { ReceivePanel } from "@/modules/money/components/receive-panel";
import { accountLabel } from "@/modules/money/lib/format";

export const metadata: Metadata = { title: "Receive money" };

/** Your account and routing numbers, to get paid from anywhere. */
export default async function ReceivePage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const sp = await searchParams;
  const accounts = await load((b) => b.listAccounts());
  if (!accounts.ok) return <><BankHead title="Receive money" /><ErrorPanel error={accounts.error} /></>;
  const items = accounts.data.items;
  const current = items.find((a) => a.id === sp.account) || items.find((a) => a.type === "checking") || items[0];
  const details = current ? await load((b) => b.receiveDetails(current.id)) : null;
  return (
    <>
      <BankHead title="Receive money" sub="Your account and routing numbers — for direct deposit, or for anyone paying you from another bank." />
      {items.length > 1 && (
        <nav className="mn-tabs" aria-label="Account">
          {items.map((a) => (
            <Link key={a.id} href={`/account/banking/receive?account=${a.id}`} aria-current={a.id === current?.id ? "page" : undefined}>{accountLabel(a)}</Link>
          ))}
        </nav>
      )}
      {!details ? (
        <div className="mn-empty"><b>No account yet</b><p>Once your account is open, its details show here.</p></div>
      ) : !details.ok ? <ErrorPanel error={details.error} /> : (
        <div className="mn-recv">
          <ReceivePanel key={details.data.accountId} details={details.data} sample={bankingMode() === "sample"} />
        </div>
      )}
      <p className="mn-muted" style={{ marginTop: 18 }}>Want someone to pay you a set amount? <Link className="mn-link" href="/account/banking/request">Request money</Link></p>
    </>
  );
}
