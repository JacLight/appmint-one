import type { Metadata } from "next";
import Link from "next/link";
import { getSetup } from "@/lib/setup";
import { PageTitle } from "@/components/dashboard-shell";
import { PayInvoice } from "@/modules/scheduling/components/account/pay-invoice";
import { myRent } from "@/modules/property/lib/resident";
import { day, money } from "@/modules/property/lib/format";

export const metadata: Metadata = { title: "Rent" };

/** Rent: what's open (each invoice's balance as the engine sends it, paid by card
 *  through client-data/pay) and what's been paid. */
export default async function RentPage() {
  const setup = await getSetup();
  const cfg = setup.property!;
  const { open, paid } = await myRent();
  const sorted = [...open].sort((a, b) => String(a.dueAt || "").localeCompare(String(b.dueAt || "")));
  return (
    <>
      <PageTitle title="Rent" />
      <section className="pm-panel" style={{ marginBottom: 22 }}>
        <div className="pm-panel-h"><h2>Due</h2></div>
        {sorted.length ? (
          <ul className="pm-rows">
            {sorted.map((inv) => (
              <li key={inv.id}>
                <span className="t">{money(inv.balance, inv.currency)} · {inv.description || `Invoice ${inv.number}`}</span>
                <PayInvoice id={inv.id} balance={inv.balance} currency={inv.currency} />
                <span className="s">#{inv.number}{inv.dueAt ? ` · due ${day(inv.dueAt)}` : ""}{inv.total !== inv.balance ? ` · ${money(inv.total, inv.currency)} billed` : ""}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pm-muted" style={{ margin: 0 }}>Nothing due. Each month’s rent shows up here with its due date, about a week before.</p>
        )}
      </section>
      <section className="pm-panel">
        <div className="pm-panel-h"><h2>Paid</h2></div>
        {paid.length ? (
          <ul className="pm-rows">
            {paid.slice(0, 24).map((inv) => (
              <li key={inv.id}>
                <span className="t">{inv.description || `Invoice ${inv.number}`}</span>
                <b>{money(inv.total, inv.currency)}</b>
                <span className="s">#{inv.number}{inv.issuedAt ? ` · ${day(inv.issuedAt)}` : ""}</span>
              </li>
            ))}
          </ul>
        ) : <p className="pm-muted" style={{ margin: 0 }}>Payments you make show up here with their receipts.</p>}
      </section>
      <p className="pm-muted" style={{ fontSize: 14, marginTop: 18 }}>Questions about a charge? Call {cfg.office.phone} or <Link className="pm-link" href="/account/messages">message the office</Link>.</p>
    </>
  );
}
