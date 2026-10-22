import type { Metadata } from "next";
import Link from "next/link";
import { getSetup } from "@/lib/setup";
import { load } from "@/modules/money/api/adapter";
import { BankHead, PersonAvatar } from "@/modules/money/components/bits";
import { Icon } from "@/modules/money/components/icons";
import { TxList } from "@/modules/money/components/tx-list";

export const metadata: Metadata = { title: "Send money" };

const B = "/account/banking";

/** Choose how to send: another bank, someone here, or between your own accounts. */
export default async function SendPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const [setup, sp] = await Promise.all([getSetup(), searchParams]);
  const bank = setup.brand.name;
  const from = sp.from ? `?from=${encodeURIComponent(sp.from)}` : "";
  const [recipients, accounts, recent] = await Promise.all([
    load((b) => b.listRecipients()),
    load((b) => b.listAccounts()),
    load((b) => b.listTransactions({ category: "transfers", direction: "debit", limit: 6 })),
  ]);
  const people = recipients.ok ? recipients.data : [];
  return (
    <>
      <BankHead title="Send money" sub="Pick how you want to send. You’ll see every detail, and any fee, before anything moves." />
      <div className="mn-ways">
        <Link className="mn-way" href={`${B}/send/external${from}`}>
          <span className="ic"><Icon name="bank" size={22} /></span>
          <b>To another bank</b>
          <span>Any U.S. bank account, with their routing and account number.</span>
          <em>Standard 1–3 business days · Same day available</em>
        </Link>
        <Link className="mn-way" href={`${B}/send/internal${from}`}>
          <span className="ic"><Icon name="bolt" size={22} /></span>
          <b>To someone at {bank}</b>
          <span>Find them by @handle, email or phone number.</span>
          <em>Instant, any day · Free</em>
        </Link>
        <Link className="mn-way" href={`${B}/send/own${from}`}>
          <span className="ic"><Icon name="swap" size={22} /></span>
          <b>Between your accounts</b>
          <span>Move money between checking and savings.</span>
          <em>Instant · Free</em>
        </Link>
      </div>

      <div className="mn-grid-main">
        <section className="mn-panel">
          <div className="mn-panel-hd"><span>Recipients</span><Link className="mn-link" href={`${B}/recipients`}>Manage</Link></div>
          {people.length ? (
            <ul className="mn-rlist">
              {people.map((r, i) => (
                <li key={r.id}>
                  <Link className="mn-rrow" href={`${B}/send/${r.kind}?to=${r.id}`}>
                    <PersonAvatar name={r.name} tone={i} />
                    <span>
                      <b>{r.nickname ? `${r.nickname} · ${r.name}` : r.name}</b>
                      <small>{r.kind === "external" ? `${r.external!.bankName} ••${r.external!.accountMask}` : `${r.internal!.handle} · ${bank}`}</small>
                    </span>
                    <span className="mn-link">Send<Icon name="chev" size={14} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mn-empty"><b>No recipients yet</b><p>People you pay are saved here so next time takes a tap.</p></div>
          )}
        </section>
        <section className="mn-panel">
          <div className="mn-panel-hd"><span>Recent transfers</span><Link className="mn-link" href={`${B}/transactions?cat=transfers&range=all`}>See all</Link></div>
          {recent.ok && recent.data.items.length ? (
            <TxList items={recent.data.items} accounts={accounts.ok ? accounts.data.items : []} compact />
          ) : (
            <div className="mn-empty"><b>Nothing sent yet</b><p>Your transfers will show here.</p></div>
          )}
        </section>
      </div>
    </>
  );
}
