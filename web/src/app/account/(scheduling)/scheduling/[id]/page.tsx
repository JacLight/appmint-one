import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSetup } from "@/lib/setup";
import { term } from "@/setups/modules";
import { bookingForm, bookingTypes, myBooking, myForms } from "@/modules/scheduling/lib/data";
import { isClosed } from "@/modules/scheduling/lib/catalog";
import { Ic } from "@/modules/scheduling/components/bits";
import { BookingView } from "@/modules/scheduling/components/account/booking-view";

type P = Promise<{ id: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  return { title: term(await getSetup(), "booking") };
}

/** One of my bookings, as the reservation record holds it (GET client-data/reservations/:id). */
export default async function BookingPage({ params, searchParams }: { params: P; searchParams: SP }) {
  const [{ id }, sp, setup] = await Promise.all([params, searchParams, getSetup()]);
  const cfg = setup.scheduling!;
  const [detail, types] = await Promise.all([myBooking(id), bookingTypes()]);
  if (!detail) notFound();
  const b = detail.booking;
  const type = types.find((t) => t.id === b.definitionId);
  const closed = isClosed(b.status);
  let form: { name: string; title: string; sent?: any; href?: string } | null = null;
  if (type?.form) {
    const [schema, answers] = await Promise.all([bookingForm(type.form), myForms().catch(() => [])]);
    if (schema) form = { name: type.form, title: schema.title || "Your form", sent: answers.find((a) => a.form === type.form && a.status !== "pending") || null, href: `/account/scheduling/${b.id}/intake` };
  }
  return (
    <>
      <Link href="/account/scheduling" className="bt-back"><Ic n="back" size={16} /> {setup.nav.customer.find((n) => n.href === "/account/scheduling")?.label || term(setup, "bookings")}</Link>
      {sp.booked && !closed && <div className="ac-banner"><Ic n="check" /> You&rsquo;re booked. We&rsquo;ve emailed the details{form && !form.sent ? " — please fill in the form below before you come in" : ""}.</div>}
      {sp.cancelled && closed && <div className="ac-banner"><Ic n="check" /> Cancelled. We&rsquo;ve emailed you a confirmation.</div>}
      {sp.moved && !closed && <div className="ac-banner"><Ic n="check" /> Moved. Your new time is below, and we&rsquo;ve emailed you the change.</div>}
      {sp.sent && <div className="ac-banner"><Ic n="check" /> Thanks — your form is with {cfg.style === "clinic" ? "your care team" : cfg.style === "firm" ? "your attorney" : "us"}.</div>}
      <BookingView cfg={cfg} detail={detail} type={type} one={term(setup, "booking")} who={{ id: b.id }} moveHref={`/account/scheduling/${b.id}/reschedule`} form={form} signedIn />
    </>
  );
}
