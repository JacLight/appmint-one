import type { Metadata } from "next";
import { load } from "@/modules/money/api/adapter";
import { BankHead, ErrorPanel } from "@/modules/money/components/bits";
import { TxBrowser, type TxSearchParams } from "@/modules/money/components/tx-browser";

export const metadata: Metadata = { title: "Transactions" };

/** Every transaction across the customer's accounts. */
export default async function TransactionsPage({ searchParams }: { searchParams: Promise<TxSearchParams> }) {
  const sp = await searchParams;
  const all = await load((b) => b.listAccounts());
  return (
    <>
      <BankHead title="Transactions" sub="Search by merchant, person, amount or reference. Tap any transaction for the full details." />
      {all.ok ? <TxBrowser sp={sp} accounts={all.data.items} basePath="/account/banking/transactions" /> : <ErrorPanel error={all.error} />}
    </>
  );
}
