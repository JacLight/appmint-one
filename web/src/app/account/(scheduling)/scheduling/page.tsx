import type { Metadata } from "next";
import Link from "next/link";
import { getSetup } from "@/lib/setup";
import { term } from "@/setups/modules";
import { myInvoices, myMemberships, myReservationRecords } from "@/modules/scheduling/lib/data";
import { dayShort, money } from "@/modules/scheduling/lib/format";
import { Reservations } from "@/modules/scheduling/reservation-system/my-account/Reservations";
import { PayInvoice } from "@/modules/scheduling/components/account/pay-invoice";
import { Ic } from "@/modules/scheduling/components/bits";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSetup();
  return { title: s.nav.customer.find((n) => n.href === "/account/scheduling")?.label || term(s, "bookings") };
}

type SP = Promise<Record<string, string | string[] | undefined>>;

/** My classes / appointments / matters: what's coming up, my memberships (studio), my
 *  invoices (with what the engine says is still owed), and the past. */
export default async function MyBookingsPage({ searchParams }: { searchParams: SP }) {
  const [setup, sp] = await Promise.all([getSetup(), searchParams]);
  const cfg = setup.scheduling!;
  const tz = cfg.timezone;
  const [records, memberships, invoices] = await Promise.all([
    myReservationRecords(),
    cfg.style === "studio" ? myMemberships().catch(() => []) : Promise.resolve([]),
    cfg.style === "studio" ? Promise.resolve([]) : myInvoices().catch(() => []),
  ]);
  const title = setup.nav.customer.find((n) => n.href === "/account/scheduling")?.label || term(setup, "bookings");
  const open = invoices.filter((i) => i.balance > 0.004);
  const settled = invoices.filter((i) => !open.includes(i)).slice(0, 6);

  return (
    <>
      {sp.bought && <div className="ac-banner"><Ic n="check" /> Payment received — it&rsquo;s on your account.</div>}

      {cfg.style === "studio" && (
        <section className="ac-passes" id="passes">
          <div className="ac-sec-h"><h2>Your membership</h2><Link className="sc-more" href="/memberships">Packs &amp; memberships <Ic n="arrow" size={15} /></Link></div>
          {memberships.length ? (
            <div className="ac-pass-list">
              {memberships.map((m) => (
                <div key={m.id} className={`ac-pass${m.active ? "" : " off"}`}>
                  <span className="ac-pass-k">{m.kind === "membership" ? "Membership" : "Class pack"}</span>
                  <b>{m.title}</b>
                  <span className="ac-pass-x">{m.active ? (m.renewsAt ? `${m.kind === "membership" ? "Renews" : "Valid until"} ${dayShort(m.renewsAt, tz)}` : "Active") : m.status ? m.status[0].toUpperCase() + m.status.slice(1) : ""}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="ac-nopass"><span>You don&rsquo;t have a class pack or membership yet.</span><Link className="btn sm clay" href="/memberships">See pricing</Link></div>
          )}
        </section>
      )}

      <Reservations
        data={{ reservations: records }}
        title={title}
        subtitle={cfg.style === "studio" ? "Your classes: move or cancel one that’s still ahead." : cfg.style === "clinic" ? "Your appointments: move or cancel one that’s still ahead." : "Your consultations: move or cancel one that’s still ahead."}
        headerAction={<p style={{ marginTop: 14 }}><Link className="btn clay sm" href="/book">{cfg.words.bookCta}</Link></p>}
      />
      {cfg.style !== "studio" && (
        <section style={{ marginTop: 34 }} id="invoices">
          <div className="ac-sec-h"><h2>Invoices</h2></div>
          {invoices.length ? (
            <ul className="cv-inv ac-inv">
              {[...open, ...settled].map((inv) => (
                <li key={inv.id}>
                  <div><b>{money(inv.total, inv.currency)}</b><span>{inv.description || `Invoice ${inv.number}`}</span><span>#{inv.number}{inv.issuedAt ? ` · ${dayShort(inv.issuedAt, tz)}` : ""}{inv.balance > 0.004 && inv.dueAt ? ` · due ${dayShort(inv.dueAt, tz)}` : ""}</span></div>
                  {inv.balance > 0.004 ? <PayInvoice id={inv.id} balance={inv.balance} currency={inv.currency} /> : <span className="sc-pill">Paid</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="cv-quiet">{cfg.style === "clinic" ? "Bills from your visits appear here once insurance has been applied." : "Invoices for your matters appear here once they’re issued."}</p>
          )}
        </section>
      )}

    </>
  );
}
