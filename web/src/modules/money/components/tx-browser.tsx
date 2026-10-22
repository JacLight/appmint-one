import Link from "next/link";
import { load } from "../api/adapter";
import type { Account, TransactionQuery, TxCategory, TxDirection } from "../api/types";
import { CATEGORY_LABEL, accountLabel } from "../lib/format";
import { ErrorPanel } from "./bits";
import { Icon } from "./icons";
import { TxFilters, type TxFilterState } from "./tx-filters";
import { TxList } from "./tx-list";

export type TxSearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

function rangeFrom(range: string | undefined): string | undefined {
  const now = new Date();
  if (range === "all") return undefined;
  if (range === "ytd") return `${now.getUTCFullYear()}-01-01`;
  const days = range === "30" ? 30 : 90;
  return new Date(now.getTime() - days * 864e5).toISOString().slice(0, 10);
}

/** Search, filter and page through transactions. `accountId` pins the list to one account. */
export async function TxBrowser({ sp, accounts, accountId, basePath }: { sp: TxSearchParams; accounts: Account[]; accountId?: string; basePath: string }) {
  const state: TxFilterState = {
    q: one(sp.q), dir: one(sp.dir), cat: one(sp.cat), range: one(sp.range), status: one(sp.status), acct: accountId ? undefined : one(sp.acct),
  };
  const pages = Math.max(1, Math.min(10, Number(one(sp.n)) || 1));
  const query: TransactionQuery = {
    accountId: accountId || state.acct,
    q: state.q,
    direction: state.dir === "credit" || state.dir === "debit" ? (state.dir as TxDirection) : undefined,
    status: state.status === "pending" ? "pending" : undefined,
    category: state.cat && state.cat in CATEGORY_LABEL ? (state.cat as TxCategory) : undefined,
    from: rangeFrom(state.range),
    limit: 50 * pages,
  };
  const res = await load((b) => b.listTransactions(query));
  const filtered = !!(state.q || state.dir || state.cat || state.status || state.acct || (state.range && state.range !== "90"));
  const keep = (drop: keyof TxFilterState) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) if (v && k !== drop) p.set(k, v);
    return `${basePath}${p.size ? `?${p}` : ""}`;
  };
  const moreHref = (() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) if (v) p.set(k, v);
    p.set("n", String(pages + 1));
    return `${basePath}?${p}`;
  })();

  return (
    <>
      <TxFilters state={state} accounts={accountId ? undefined : accounts.map((a) => ({ id: a.id, label: accountLabel(a) }))} />
      {res.ok && filtered && (
        <div className="mn-activefilters">
          <span>{res.data.total ?? res.data.items.length} {(res.data.total ?? res.data.items.length) === 1 ? "transaction" : "transactions"}</span>
          {state.q && <Link href={keep("q")}>“{state.q}” <Icon name="x" size={12} /></Link>}
          {state.cat && <Link href={keep("cat")}>{CATEGORY_LABEL[state.cat as TxCategory] || state.cat} <Icon name="x" size={12} /></Link>}
          {state.acct && <Link href={keep("acct")}>{accountLabel(accounts.find((a) => a.id === state.acct) || { name: "Account", mask: "" })} <Icon name="x" size={12} /></Link>}
          <Link href={basePath} className="clear">Clear all</Link>
        </div>
      )}
      {!res.ok ? (
        <ErrorPanel error={res.error} title="We couldn’t load transactions" />
      ) : res.data.items.length === 0 ? (
        <div className="mn-empty">
          <b>{filtered ? "No transactions match" : "No transactions yet"}</b>
          <p>{filtered ? "Try a different search, or widen the date range." : "When money comes in or goes out, it shows up here right away."}</p>
          {filtered && <Link className="btn ghost sm" href={basePath}>Clear filters</Link>}
        </div>
      ) : (
        <>
          <TxList items={res.data.items} accounts={accounts} showAccount={!accountId && accounts.length > 1} />
          {res.data.nextCursor && (
            <div className="mn-more"><Link className="btn ghost sm" href={moreHref} scroll={false}>Show more</Link></div>
          )}
        </>
      )}
    </>
  );
}
