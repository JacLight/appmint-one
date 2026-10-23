import type { Metadata } from "next";
import { getSetup } from "@/lib/setup";
import { bankingMode, usesEngineBanking, load } from "@/modules/money/api/adapter";
import { BankHead, ErrorPanel } from "@/modules/money/components/bits";
import { BankRequestsPanel } from "@/modules/money/components/bank-domain-panels";
import { RequestForm, RequestLists } from "@/modules/money/components/requests";

export const metadata: Metadata = { title: "Request money" };

export default async function RequestPage() {
  const setup = await getSetup();
  if (usesEngineBanking()) {
    const accounts = await load(b => b.listAccounts());
    return <><BankHead title="Same-bank money requests" sub="Create or review full-amount USD requests. No message is sent automatically." />{accounts.ok ? <BankRequestsPanel accounts={accounts.data.items} /> : <ErrorPanel error={accounts.error} />}</>;
  }
  const [accounts, incoming, outgoing] = await Promise.all([
    load((b) => b.listAccounts()),
    load((b) => b.listRequests("incoming")),
    load((b) => b.listRequests("outgoing")),
  ]);
  return (
    <>
      <BankHead title="Request money" sub={`Ask someone at ${setup.brand.name} to pay you, or share a link anyone can pay through.`} />
      {!accounts.ok ? <ErrorPanel error={accounts.error} /> : (
        <div className="mn-req">
          <RequestForm accounts={accounts.data.items} bank={setup.brand.name} />
          {incoming.ok && outgoing.ok
            ? <RequestLists incoming={incoming.data} outgoing={outgoing.data} accounts={accounts.data.items} sample={bankingMode() === "sample"} />
            : <ErrorPanel error={(!incoming.ok ? incoming.error : !outgoing.ok ? outgoing.error : null)!} title="We couldn’t load your requests" />}
        </div>
      )}
    </>
  );
}
