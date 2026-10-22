import type { Metadata } from "next";
import { getSetup } from "@/lib/setup";
import { load } from "@/modules/money/api/adapter";
import { BankHead, ErrorPanel } from "@/modules/money/components/bits";
import { PrintButton } from "@/modules/money/components/print-button";
import { fmt, fmtDate, periodLabel, txTitle } from "@/modules/money/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const r = await load(async (b) => b.getStatement((await params).id));
  return { title: r.ok ? `Statement · ${periodLabel(r.data.period)}` : "Statement" };
}

/** A printable monthly statement. */
export default async function StatementPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, setup] = await Promise.all([params, getSetup()]);
  const res = await load((b) => b.getStatement(id));
  if (!res.ok) return <><BankHead title="Statement" back={{ href: "/account/banking/statements", label: "Statements" }} /><ErrorPanel error={res.error} /></>;
  const s = res.data;
  return (
    <>
      <BankHead title={periodLabel(s.period)} back={{ href: `/account/banking/statements?account=${s.accountId}`, label: "Statements" }}
        sub={`${s.account.name} ••${s.account.mask}`}
        actions={<>{s.pdfUrl && <a className="btn ghost sm" href={s.pdfUrl}>Download PDF</a>}<PrintButton label="Print or save PDF" /></>} />
      <article className="mn-doc">
        <header className="mn-doc-hd">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {setup.brand.logo ? <img src={setup.brand.logo} alt={setup.brand.name} style={{ height: 28 }} /> : <h2>{setup.brand.name}</h2>}
            <p style={{ margin: "10px 0 0" }}><b>{s.accountHolder}</b></p>
          </div>
          <div style={{ textAlign: "right" }}>
            <h2>Account statement</h2>
            <p style={{ margin: "6px 0 0" }}>{s.account.name} ••{s.account.mask}<br />{fmtDate(s.periodStart, { month: "long", day: "numeric", year: "numeric" })} – {fmtDate(s.periodEnd, { month: "long", day: "numeric", year: "numeric" })}</p>
          </div>
        </header>
        <div className="mn-doc-sum">
          <div><span>Opening balance</span><b>{fmt(s.openingBalance)}</b></div>
          <div><span>Money in</span><b>{fmt(s.totalIn)}</b></div>
          <div><span>Money out</span><b>{fmt(s.totalOut)}</b></div>
          <div><span>Closing balance</span><b>{fmt(s.closingBalance)}</b></div>
        </div>
        {s.transactions.length === 0 ? <p>No transactions this month.</p> : (
          <table>
            <thead><tr><th>Date</th><th>Description</th><th className="n">Money in</th><th className="n">Money out</th><th className="n">Balance</th></tr></thead>
            <tbody>
              <tr><td>{fmtDate(s.periodStart)}</td><td>Opening balance</td><td /><td /><td className="n">{fmt(s.openingBalance)}</td></tr>
              {s.transactions.map((t) => (
                <tr key={t.id}>
                  <td>{fmtDate(t.postedAt || t.createdAt)}</td>
                  <td>{txTitle(t)}{t.statementDescriptor ? <><br /><span style={{ color: "#777", fontSize: 11.5 }}>{t.statementDescriptor}</span></> : null}</td>
                  <td className="n">{t.direction === "credit" ? fmt(t.amount) : ""}</td>
                  <td className="n">{t.direction === "debit" ? fmt(t.amount) : ""}</td>
                  <td className="n">{t.balanceAfter ? fmt(t.balanceAfter) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <footer className="mn-doc-foot">
          {s.interestPaid && s.interestPaid.amount > 0 ? <>Interest paid this period: {fmt(s.interestPaid)}. </> : null}
          {s.feesCharged ? <>Fees charged this period: {fmt(s.feesCharged)}. </> : null}
          Questions about this statement? Message us in the app. Report errors within 60 days of the statement date.
        </footer>
      </article>
    </>
  );
}
