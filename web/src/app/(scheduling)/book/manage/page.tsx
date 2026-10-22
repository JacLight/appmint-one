import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSetup } from "@/lib/setup";
import { getSession } from "@/lib/auth";
import { term } from "@/setups/modules";
import { bookingForm, bookingTypes, guestBooking } from "@/modules/scheduling/lib/data";
import { isClosed } from "@/modules/scheduling/lib/catalog";
import { Empty, Ic } from "@/modules/scheduling/components/bits";
import { BookingView } from "@/modules/scheduling/components/account/booking-view";
import { MovePicker } from "@/modules/scheduling/components/account/move-picker";

export const metadata: Metadata = { title: "Your booking" };
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** A booking made without an account, found by the email on it and its number
 *  (GET crm/reservations/by-email/:email/:number): see it, move it, cancel it. */
export default async function ManageBookingPage({ searchParams }: { searchParams: SP }) {
  const [sp, setup, session] = await Promise.all([searchParams, getSetup(), getSession()]);
  const cfg = setup.scheduling!;
  const email = (one(sp.email) || "").trim().toLowerCase();
  const number = (one(sp.n) || "").trim().toUpperCase();
  const cls = cfg.style === "studio" ? "sc-studio" : cfg.style === "clinic" ? "sc-clinic" : "sc-firm";
  const [detail, types] = email && number ? await Promise.all([guestBooking(email, number), bookingTypes()]) : [null, []];
  // Signed in as the person on the booking: their account page has everything.
  if (detail && session.signedIn && session.customer?.email?.toLowerCase() === email && !one(sp.move)) redirect(`/account/scheduling/${detail.booking.id}${one(sp.booked) ? "?booked=1" : ""}`);
  const type = detail ? types.find((t) => t.id === detail.booking.definitionId) : undefined;
  const q = `email=${encodeURIComponent(email)}&n=${encodeURIComponent(number)}`;
  const here = `/book/manage?${q}`;
  const closed = detail ? isClosed(detail.booking.status) : false;
  const formSchema = type?.form ? await bookingForm(type.form) : null;

  let body: React.ReactNode;
  if (!email || !number) {
    body = (
      <div className="mv">
        <h1 className="mv-h">Find your booking</h1>
        <p className="cv-quiet">Use the email you booked with and the booking number from your confirmation.</p>
        <form className="bt-card mg-find" action="/book/manage" method="get">
          <label className="bk-lbl" htmlFor="mg-email">Email</label>
          <input id="mg-email" className="bk-in" name="email" type="email" required defaultValue={email} />
          <label className="bk-lbl" htmlFor="mg-n">Booking number</label>
          <input id="mg-n" className="bk-in" name="n" required maxLength={20} defaultValue={number} placeholder="e.g. J6YN8YHB" />
          <button className="btn clay lg bk-wide" type="submit">Find booking</button>
        </form>
      </div>
    );
  } else if (!detail) {
    body = <Empty title="We couldn’t find that booking" action={<Link className="btn clay sm" href="/book/manage">Try again</Link>}>Check the email and the booking number on your confirmation{cfg.place.phone ? `, or call ${cfg.place.phone}` : ""}.</Empty>;
  } else if (one(sp.move) && type && !closed && Date.parse(detail.booking.startTime) > Date.now()) {
    body = <MovePicker cfg={cfg} detail={detail} type={type} who={{ email, number }} base={`${here}&move=1&`} back={here} done={`${here}&moved=1`} day={one(sp.day)} at={one(sp.at)} />;
  } else {
    body = (
      <>
        {one(sp.booked) && !closed && <div className="ac-banner"><Ic n="check" /> You&rsquo;re booked. We&rsquo;ve emailed the details to {email}. Keep your booking number, <b>{number}</b>, to move or cancel.</div>}
        {one(sp.cancelled) && closed && <div className="ac-banner"><Ic n="check" /> Cancelled. We&rsquo;ve emailed you a confirmation.</div>}
        {one(sp.moved) && !closed && <div className="ac-banner"><Ic n="check" /> Moved. Your new time is below, and we&rsquo;ve emailed you the change.</div>}
        <BookingView cfg={cfg} detail={detail} type={type} one={term(setup, "booking")} who={{ email, number }} moveHref={`${here}&move=1`}
          form={type?.form && formSchema ? { name: type.form, title: formSchema.title || "Your form" } : null} signedIn={false} />
        {!session.signedIn && <p className="cv-quiet mg-acct"><Link href={`/signup?next=${encodeURIComponent("/account/scheduling")}`}>Create an account with {email}</Link> to see every booking in one place.</p>}
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className={`scm ${cls}`}>
        <section className="wrap mg-wrap">{body}</section>
      </main>
      <SiteFooter />
    </>
  );
}
