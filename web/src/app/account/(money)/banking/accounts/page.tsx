import type { Metadata } from "next";
import Link from "next/link";
import { getSetup } from "@/lib/setup";
import { term } from "@/setups/modules";
import { load } from "@/modules/money/api/adapter";
import { Balance, BankHead, ErrorPanel, Sparkline, StatusChip } from "@/modules/money/components/bits";
import { Icon } from "@/modules/money/components/icons";
import { ACCOUNT_TYPE_LABEL, fmt, fmtDate } from "@/modules/money/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${term(await getSetup(), "account")}s` };
}

const B = "/account/banking";

export default async function AccountsPage() {
  const setup = await getSetup();
  const word = term(setup, "account");
  const res = await load((b) => b.listAccounts());
  if (!res.ok) return <><BankHead title={`${word}s`} /><ErrorPanel error={res.error} title="We couldn’t load your accounts" /></>;
  const { items, total } = res.data;
  return (
    <>
      <BankHead title={`${word}s`} sub={<>Total available <b style={{ color: "var(--text)" }}>{fmt(total.available)}</b> across {items.length} {items.length === 1 ? word.toLowerCase() : `${word.toLowerCase()}s`}</>}
        actions={<Link className="btn ghost sm" href={`${B}/send/own`}><Icon name="swap" size={16} />Move between {word.toLowerCase()}s</Link>} />
      <div className="mn-acctcards">
        {items.map((a) => (
          <article key={a.id} className="mn-panel mn-acctcard">
            <Link href={`${B}/accounts/${a.id}`} className="mn-acctcard-hd">
              <span className={`mn-acc-ic ${a.type}`}><Icon name={a.type === "savings" ? "piggy" : "bank"} size={18} /></span>
              <span className="mn-acc-name"><b>{a.nickname || a.name}</b><span>{ACCOUNT_TYPE_LABEL[a.type]} ••{a.mask} · since {fmtDate(a.openedAt, { month: "short", year: "numeric" })}</span></span>
              {a.status !== "open" ? <StatusChip status={a.status} /> : <Icon name="chev" size={18} />}
            </Link>
            <div className="mn-muted">Available balance</div>
            <Balance value={a.balances.available} className="lg" />
            <div className="mn-acct-bals">
              <div><span>Current</span><b>{fmt(a.balances.current)}</b></div>
              {a.balances.pending && a.balances.pending.amount > 0 && <div><span>Pending</span><b>{fmt(a.balances.pending)}</b></div>}
              {a.apy !== undefined && <div><span>APY</span><b>{a.apy.toFixed(2)}%</b></div>}
              {a.interestYtd && <div><span>Interest this year</span><b className="mn-amt in">{fmt(a.interestYtd)}</b></div>}
            </div>
            {a.balanceHistory && <Sparkline points={a.balanceHistory} height={70} />}
            <div className="mn-acctcard-acts">
              <Link className="btn ghost sm" href={`${B}/accounts/${a.id}`}>Activity</Link>
              <Link className="btn ghost sm" href={`${B}/receive?account=${a.id}`}>Account details</Link>
              <Link className="btn ghost sm" href={`${B}/statements?account=${a.id}`}>Statements</Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
