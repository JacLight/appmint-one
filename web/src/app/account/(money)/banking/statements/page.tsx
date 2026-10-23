import type { Metadata } from "next";
import Link from "next/link";
import { load, usesEngineBanking } from "@/modules/money/api/adapter";
import type { Statement } from "@/modules/money/api/types";
import { BankHead, ErrorPanel } from "@/modules/money/components/bits";
import { Icon } from "@/modules/money/components/icons";
import {
  accountLabel,
  fmt,
  fmtDate,
  periodLabel,
} from "@/modules/money/lib/format";

export const metadata: Metadata = { title: "Statements" };

const B = "/account/banking/statements";

/** Monthly statements per account. */
export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const sp = await searchParams;
  const accounts = await load((b) => b.listAccounts());
  if (!accounts.ok)
    return (
      <>
        <BankHead title="Statements" />
        <ErrorPanel error={accounts.error} />
      </>
    );
  const items = accounts.data.items;
  const current = items.find((a) => a.id === sp.account) || items[0];
  const res = current
    ? await load((b) => b.listStatements({ accountId: current.id }))
    : null;
  const byYear = new Map<string, Statement[]>();
  if (res?.ok)
    for (const s of res.data) {
      const y = s.period.slice(0, 4);
      byYear.set(y, [...(byYear.get(y) || []), s]);
    }
  return (
    <>
      <BankHead
        title="Statements"
        sub={
          "A statement for every month, ready to view, print or save as PDF."
        }
      />
      {items.length > 1 && (
        <nav className="mn-tabs" aria-label="Account">
          {items.map((a) => (
            <Link
              key={a.id}
              href={`${B}?account=${a.id}`}
              aria-current={a.id === current?.id ? "page" : undefined}
            >
              {accountLabel(a)}
            </Link>
          ))}
        </nav>
      )}
      {!res ? (
        <div className="mn-empty">
          <b>No accounts yet</b>
        </div>
      ) : !res.ok ? (
        <ErrorPanel error={res.error} />
      ) : res.data.length === 0 ? (
        <div className="mn-empty">
          <b>No statements yet</b>
          <p>
            Your first statement is ready a few days after your first full
            month.
          </p>
        </div>
      ) : (
        [...byYear.entries()].map(([year, list]) => (
          <section key={year} className="mn-panel" style={{ marginBottom: 16 }}>
            <div className="mn-panel-hd">
              <span>{year}</span>
              <span className="mn-muted">
                {list.length} {list.length === 1 ? "statement" : "statements"}
              </span>
            </div>
            <ul className="mn-stmts">
              {list.map((s) => (
                <li key={s.id}>
                  <div className="mn-stmt">
                    <span className="mn-stmt-ic">
                      <Icon name="statement" size={18} />
                    </span>
                    <span>
                      <b>{periodLabel(s.period)}</b>
                      <small>
                        {fmtDate(s.periodStart)} –{" "}
                        {fmtDate(s.periodEnd, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </small>
                    </span>
                    <span className="num hide-sm">
                      <small>Money in</small>
                      <span className="mn-amt in">+{fmt(s.totalIn)}</span>
                    </span>
                    <span className="num hide-sm">
                      <small>Closing balance</small>
                      {fmt(s.closingBalance)}
                    </span>
                    <span style={{ display: "flex", gap: 6 }}>
                      {s.pdfUrl && (
                        <a
                          className="mn-iconbtn"
                          href={s.pdfUrl}
                          aria-label="Download PDF"
                        >
                          <Icon name="download" size={16} />
                        </a>
                      )}
                      <Link className="btn ghost sm" href={`${B}/${s.id}`}>
                        View
                      </Link>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <p className="mn-muted">
        Need an older statement or a bank letter?{" "}
        <Link className="mn-link" href="/account/messages">
          Message us
        </Link>
      </p>
    </>
  );
}
