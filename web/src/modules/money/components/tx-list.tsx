import Link from "next/link";
import type { Account, Transaction } from "../api/types";
import { CATEGORY_LABEL, dayHeading, dayKey, fmtTime, txTitle } from "../lib/format";
import { Signed, TxAvatar } from "./bits";

export const TX_BASE = "/account/banking/transactions";

/** Transactions grouped by day, newest first. */
export function TxList({ items, accounts, showAccount, compact }: { items: Transaction[]; accounts?: Account[]; showAccount?: boolean; compact?: boolean }) {
  const groups: { key: string; rows: Transaction[] }[] = [];
  for (const t of items) {
    const k = dayKey(t.createdAt);
    const g = groups[groups.length - 1];
    if (g && g.key === k) g.rows.push(t);
    else groups.push({ key: k, rows: [t] });
  }
  const acct = (id: string) => accounts?.find((a) => a.id === id);
  return (
    <div className={`mn-txl${compact ? " compact" : ""}`}>
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="mn-txl-day">{dayHeading(g.key)}</h3>
          <ul>
            {g.rows.map((t) => {
              const a = showAccount ? acct(t.accountId) : undefined;
              return (
                <li key={`${t.accountId}:${t.id}`}>
                  <Link href={`${TX_BASE}/${encodeURIComponent(t.id)}?account=${encodeURIComponent(t.accountId)}`} className="mn-tx">
                    <TxAvatar t={t} />
                    <span className="mn-tx-main">
                      <b>{txTitle(t)}</b>
                      <span>
                        {t.status === "pending" ? <em className="mn-pend">Pending</em> : null}
                        {t.memo && (t.kind === "internal" || t.kind === "ach" || t.kind === "own") ? t.memo : CATEGORY_LABEL[t.category]}
                        {" · "}{fmtTime(t.createdAt)}
                        {a ? ` · ••${a.mask}` : ""}
                      </span>
                    </span>
                    <span className="mn-tx-amt"><Signed t={t} /></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
