import type { Metadata } from "next";
import Link from "next/link";
import { getSetup } from "@/lib/setup";
import { term } from "@/setups/modules";
import { BankAccountPreferences } from "@/modules/money/components/account-servicing";
import { load, usesEngineBanking } from "@/modules/money/api/adapter";
import {
  Balance,
  BankHead,
  ErrorPanel,
  Sparkline,
} from "@/modules/money/components/bits";
import { Icon } from "@/modules/money/components/icons";
import {
  TxBrowser,
  type TxSearchParams,
} from "@/modules/money/components/tx-browser";
import { ACCOUNT_TYPE_LABEL, fmt, fmtDate } from "@/modules/money/lib/format";

const B = "/account/banking";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const r = await load(async (b) => b.getAccount((await params).id));
  return { title: r.ok ? r.data.nickname || r.data.name : "Account" };
}

/** One account: balances, then every transaction with search and filters. */
export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<TxSearchParams>;
}) {
  const [{ id }, sp, setup] = await Promise.all([
    params,
    searchParams,
    getSetup(),
  ]);
  const word = term(setup, "account");
  const [acc, all] = await Promise.all([
    load((b) => b.getAccount(id)),
    load((b) => b.listAccounts()),
  ]);
  if (!acc.ok)
    return (
      <>
        <BankHead
          title={word}
          back={{ href: `${B}/accounts`, label: `${word}s` }}
        />
        <ErrorPanel error={acc.error} />
      </>
    );
  const a = acc.data;
  const accounts = all.ok ? all.data.items : [a];
  return (
    <>
      <BankHead
        back={{ href: `${B}/accounts`, label: `${word}s` }}
        title={a.nickname || a.name}
        sub={`${ACCOUNT_TYPE_LABEL[a.type]} ••${a.mask} · Opened ${fmtDate(
          a.openedAt,
          { month: "long", year: "numeric" }
        )}`}
        actions={
          <>
            <Link className="btn clay sm" href={`${B}/send?from=${a.id}`}>
              <Icon name="sendUp" size={16} />
              Send
            </Link>
            <Link className="btn ghost sm" href={`${B}/send/own?from=${a.id}`}>
              <Icon name="swap" size={16} />
              Move
            </Link>
            <Link
              className="btn ghost sm"
              href={`${B}/receive?account=${a.id}`}
            >
              Account details
            </Link>
          </>
        }
      />
      <section className="mn-panel mn-total" style={{ marginBottom: 20 }}>
        <div className="mn-acct-hero">
          <div>
            <div className="mn-muted">Available balance</div>
            <Balance value={a.balances.available} className="xl" />
          </div>
          <div className="mn-acct-bals" style={{ marginTop: 0 }}>
            <div>
              <span>Current</span>
              <b>{fmt(a.balances.current)}</b>
            </div>
            {a.balances.pending && a.balances.pending.amount > 0 && (
              <div>
                <span>Pending</span>
                <b>{fmt(a.balances.pending)}</b>
              </div>
            )}
            {a.apy !== undefined && (
              <div>
                <span>APY</span>
                <b>{a.apy.toFixed(2)}%</b>
              </div>
            )}
            {a.interestYtd && (
              <div>
                <span>Interest this year</span>
                <b className="mn-amt in">{fmt(a.interestYtd)}</b>
              </div>
            )}
            {a.last30Days && (
              <div>
                <span>Last 30 days</span>
                <b>
                  <span className="mn-amt in">
                    +{fmt(a.last30Days.moneyIn)}
                  </span>{" "}
                  <span className="mn-muted">/</span> −
                  {fmt(a.last30Days.moneyOut)}
                </b>
              </div>
            )}
          </div>
        </div>
        {a.balanceHistory && (
          <Sparkline points={a.balanceHistory} height={80} />
        )}
      </section>
      {a.gaps?.length ? (
        <section className="mn-panel">
          <h3>Account opening is pending</h3>
          <ul>
            {a.gaps.map((gap, index) => (
              <li key={index}>{gap}</li>
            ))}
          </ul>
          <Link className="mn-link" href="/account/banking/identity">
            Identity verification
          </Link>
        </section>
      ) : null}
      {usesEngineBanking() && <BankAccountPreferences account={a} />}
      <h2 className="mn-h2">Transactions</h2>
      <TxBrowser
        sp={sp}
        accounts={accounts}
        accountId={a.id}
        basePath={`${B}/accounts/${a.id}`}
      />
    </>
  );
}
