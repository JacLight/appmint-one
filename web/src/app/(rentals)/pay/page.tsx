import { SiteHeader } from "@/components/site-header";
import { EmptyState } from "@/components/empty-state";
import { paymentViewAction } from "@/modules/rentals/actions/pay";
import { PayClient } from "@/modules/rentals/components/pay/pay-client";

export const metadata = { title: "Pay" };
export const dynamic = "force-dynamic";

/** Generic take-payment page.
 *
 *  A redirect only needs the BOOKING ID: `/pay?id=<bookingId>`. `type` (what it's for)
 *  and `amount` may ride along for display, but the SERVER derives what is actually
 *  owed from the booking — a tampered link cannot change the charge. No sign-in, so a
 *  guest can pay the same way an account holder does. */
const TYPE_LABEL: Record<string, string> = {
  booking: "Booking payment",
  request: "Payment request",
  tip: "Tip",
  other: "Payment",
  balance: "Balance due",
  overstay: "Overstay charge",
  damage: "Damage charge",
  addon: "Upgrade",
  charge: "Additional charge",
  deposit: "Deposit",
};

export default async function PayPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  // A link points at one of three things, and the server resolves all of them through
  // the same endpoint:
  //   ?t=<payToken>   — an ad-hoc request link/QR (the unguessable public bearer token,
  //                     which is what host-generated links actually carry)
  //   ?req=stowbo-pr… — the internal request ref (older links / host tooling)
  //   ?id=<bookingId> — a balance owed on a booking
  const id = sp.t || sp.token || sp.req || sp.request || sp.ref || sp.id || sp.booking || sp.bookingId;
  const label = sp.type ? (TYPE_LABEL[sp.type] || sp.type) : undefined;

  if (!id) {
    return (
      <>
        <SiteHeader />
        <main className="pay-wrap">
          <EmptyState title="Nothing to pay for" note="This payment link is missing its reference. Check the link in your email, text message, or the QR code you scanned." ctaLabel="Go home" ctaHref="/" />
        </main>
      </>
    );
  }

  const res = await paymentViewAction(id);
  if (!res.ok) {
    // The API's raw "Not Found" tells a customer nothing. A link lands here when it has
    // already been paid and cleared, when it was cancelled, or when it was raised on a
    // different environment — so say what to do rather than what failed.
    const missing = /not found|404/i.test(res.error);
    return (
      <>
        <SiteHeader />
        <main className="pay-wrap">
          <EmptyState
            title={missing ? "This payment link isn’t active" : "We couldn’t open that payment"}
            note={missing
              ? "It may already have been paid, or it may have been cancelled. Ask whoever sent it for a fresh link — nothing has been charged."
              : res.error}
            ctaLabel="Go home"
            ctaHref="/"
          />
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="pay-wrap"><PayClient view={res.view} label={label} payRef={id} /></main>
    </>
  );
}
