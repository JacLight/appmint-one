import Link from "next/link";
import { PageTitle } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/empty-state";
import { requireSession } from "@/lib/guards";
import { routes } from "@/lib/nav";
import { stowbo } from "@/api/rentals";
import { formatMoney } from "@/lib/utils";
import { fmtFull, fmtDate, duration } from "@/lib/dates";
import { CancelBooking } from "@/modules/rentals/components/account/cancel-booking";
import { ExtendBooking } from "@/modules/rentals/components/account/extend-booking";
import { ContactCard } from "@/modules/rentals/components/account/contact-card";
import { BookingTracker } from "@/modules/rentals/components/account/booking-tracker";
import { BookingActivity } from "@/modules/rentals/components/account/booking-activity";
import { RequestActions } from "@/modules/rentals/components/account/request-actions";
import { AddAddon, type AddOnOption } from "@/modules/rentals/components/account/add-addon";
import { Delegations } from "@/modules/rentals/components/account/delegations";
import { bookingStage } from "@/modules/rentals/lib/custody";
import { getMarket } from "@/modules/rentals/market/config";
import { MarketTrip } from "@/modules/rentals/market/market-trips";

export async function generateMetadata() {
  const m = await getMarket();
  return { title: m ? m.cfg.copy.tripNoun.replace(/^./, (c) => c.toUpperCase()) : "Booking" };
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed", active: "In storage", in_custody: "In storage",
  completed: "Completed", settled: "Completed", cancelled: "Cancelled", new: "Confirmed",
};

export default async function BookingDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ booked?: string }> }) {
  await requireSession();
  const { id } = await params;
  // Stays / gear setups show their own trip page; Stowbo continues below, unchanged.
  const market = await getMarket();
  if (market) return <MarketTrip m={market} id={id} booked={(await searchParams).booked} />;
  const env = await stowbo.booking(id).catch(() => null);
  const d: any = env?.data;

  if (!d) {
    return (
      <>
        <PageTitle title="Booking" />
          <EmptyState title="Booking not found" note="This booking may have been removed, or it isn’t one of yours." ctaLabel="Back to bookings" ctaHref={`${routes.account}/bookings`} />
      </>
    );
  }

  const items = (d.items ?? []) as any[];
  const spaces = items.filter((it) => !it.kind || it.kind === "space");
  const addons = items.filter((it) => it.kind === "addon");

  // Host contact + the space's address/coords (for directions) — this is a
  // confirmed booking, so the exact location is theirs to have.
  const [host, listingEnv, timeline, due, delegations, myItems] = await Promise.all([
    stowbo.bookingHost(id).catch(() => null),
    spaces[0]?.listing ? stowbo.listing(spaces[0].listing).catch(() => null) : Promise.resolve(null),
    stowbo.bookingTimeline(id).catch(() => null),
    // Paid / still due, from the same computation the host sees.
    stowbo.bookingDue(id, "current").catch(() => null),
    // Pickups the guest has handed to someone else, and the items they could hand off.
    // null = this backend has no delegated pickup yet → the card stays hidden.
    stowbo.delegations(String(env?.sk || id)).catch(() => null),
    stowbo.myItems().catch(() => []),
  ]);
  const bookingItems = (Array.isArray(myItems) ? myItems : []).filter((it) => it.booking === String(env?.sk) || it.booking === id || it.booking === String(d.name)).sort((a, b) => a.id.localeCompare(b.id));
  // Money rows that are neither the stay nor an add-on: fees, tax, extra charges, credits.
  const moneyRows = items.filter((it) => it.kind && !["space", "addon"].includes(it.kind) && Number(it.amount ?? 0) !== 0);
  const ROW_LABEL: Record<string, string> = { fee: "Fee", tax: "Tax", charge: "Charge", discount: "Discount", refund: "Refund", waiver: "Waived", credit: "Credit", overstay: "Overstay", reversal: "Reversal" };
  const ld: any = (listingEnv as any)?.listing?.data;
  const addr = ld?.address;
  const addressStr = [addr?.street1, addr?.street2, [addr?.city, addr?.state].filter(Boolean).join(", "), addr?.zip].filter(Boolean).join(", ");
  const loc = ld?.location;
  const dirDest = loc?.lat != null && loc?.lng != null ? `${loc.lat},${loc.lng}` : addressStr;
  const directionsUrl = dirDest ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dirDest)}` : null;
  const instructions: string | undefined = ld?.bookingInstructions;

  // Upgrades: what this space offers (catalog), what's already bought (add-on LINES on
  // the order — addAdjustment pushes them into items with kind 'addon'), and — for
  // service upgrades — how the host's fulfilment is going (matched to the request it filed).
  // Show every add-on row, including reversed ones (struck) and their reversal rows —
  // the guest got an email about the reversal, the bill should explain it too.
  const purchasedAddons = addons;
  const standingAddons = addons.filter((a) => a.reversedBy == null && a.reversalOf == null);
  const ownedNames = new Set<string>(standingAddons.map((a) => a.code || a.name).filter(Boolean));
  const spaceQty = spaces.reduce((s, l) => s + (Number(l.quantity) || 1), 0) || 1;
  const addonOptions: AddOnOption[] = ((listingEnv as any)?.addOns ?? [])
    .map((e: any) => e?.data ?? e)
    .filter((a: any) => a?.name && !ownedNames.has(a.name) && a.status !== "inactive")
    .map((a: any) => ({ name: a.name, label: a.title || a.label || a.name, price: Number(a.price || 0), chargeEvery: a.chargeEvery, description: a.description, service: !!a.service }));
  const reqs = (d.requests ?? []) as any[];
  const REQ_STATE: Record<string, string> = { open: "Sent to your host", acknowledged: "Your host is on it", ready: "Ready for you", done: "Done", declined: "Host couldn’t do it" };

  const status = String(d.status ?? "confirmed");
  const cancelled = status === "cancelled";
  const stage = bookingStage(status, bookingItems.length ? bookingItems : spaces);
  const displayStatus = cancelled ? status : stage.index === 2 ? "completed" : stage.index === 1 ? "in_custody" : status;
  const ongoing = !cancelled && stage.index < 2;
  const spaceIdx = items.findIndex((it) => !it.kind || it.kind === "space");
  const spaceLine = spaceIdx >= 0 ? items[spaceIdx] : null;
  const extendable = !!spaceLine?.endDate && ongoing;

  const cp = d.cancellationPolicy ?? {};
  const freeUntil = cp.freeUntil ? fmtFull(cp.freeUntil) : null;
  const refundNote = cancelled ? undefined
    : freeUntil ? `Free cancellation until ${freeUntil}.`
    : cp.refundablePortion === 0 ? "This booking is non-refundable."
    : cp.refundablePortion != null && cp.refundablePortion < 1 ? `${Math.round(cp.refundablePortion * 100)}% is refundable.`
    : undefined;

  const cur = d.currency ?? "USD";
  const cents = (n?: number) => formatMoney((n ?? 0) * 100, cur);

  return (
    <>
      <PageTitle title="Booking" />
        <Link className="bkd-back" href={`${routes.account}/bookings`}>← All bookings</Link>

        <div className="bkd-head">
          <div>
            <h1 className="bkd-title">{spaces[0]?.listingTitle || "Your booking"}</h1>
            <div className="bkd-sub">Ref <b>#{d.name}</b>{env?.createdate ? <> · Booked {fmtDate(env.createdate)}</> : null}</div>
          </div>
          <span className={`bk-status s-${displayStatus}`}>{STATUS_LABEL[displayStatus] || displayStatus}</span>
        </div>

        {cancelled && <div className="bkd-banner">This booking was cancelled. Any refund follows the listing’s cancellation policy.</div>}

        {!cancelled && <BookingTracker stage={stage} />}

        <div className="bkd-grid">
          <div className="bkd-main">
            <div className="tcard bkd-card">
              <h3>What you booked</h3>
              {spaces.map((l, i) => {
                const dur = duration(l.startDate, l.endDate);
                return (
                  <div className="bkd-item" key={i}>
                    <div className="bkd-item-top">
                      <span className="bkd-item-title">{l.listingTitle || "Space"}{l.quantity > 1 ? ` ×${l.quantity}` : ""}</span>
                      {l.subtotal != null || l.amount != null || l.price != null ? <span className="bkd-item-amt">{cents(l.subtotal ?? l.amount ?? l.price)}</span> : null}
                    </div>
                    {dur ? <div className="bkd-item-chip">{dur}</div> : null}
                    <div className="bkd-dates">
                      <div className="bkd-dt"><span>Drop-off</span><b>{fmtFull(l.startDate)}</b></div>
                      <span className="bkd-dt-sep" aria-hidden>→</span>
                      <div className="bkd-dt"><span>Pick-up</span><b>{fmtFull(l.endDate)}</b></div>
                    </div>
                  </div>
                );
              })}
              <div className="bkd-totals">
                {moneyRows.map((r, i) => {
                  const amt = Number(r.amount ?? 0);
                  return (
                    <div className={`bkd-trow${r.reversedBy != null ? " struck" : ""}`} key={`m${i}`}>
                      <span>{r.label || ROW_LABEL[r.kind!] || r.kind}{r.by === "platform" ? "" : ""}</span>
                      <b className={amt < 0 ? "bkd-neg" : ""}>{amt < 0 ? "−" : ""}{cents(Math.abs(amt))}</b>
                    </div>
                  );
                })}
                {(() => { const dep = typeof d.deposit === "object" ? d.deposit?.amount : d.deposit; return dep ? <div className="bkd-trow"><span>Refundable deposit</span><b>{cents(dep)}</b></div> : null; })()}
                <div className="bkd-trow bkd-total"><span>Total</span><b>{cents(d.total)}</b></div>
                {due && due.paid > 0 ? <div className="bkd-trow"><span>Paid</span><b>{cents(due.paid)}</b></div> : null}
                {due && due.due > 0 && !cancelled ? <div className="bkd-trow"><span>{due.metered ? "Running total due" : "Still to pay"}</span><b className="bkd-due">{cents(due.due)}</b></div> : null}
                {due && due.paid > 0 && due.due <= 0 && !cancelled ? <div className="bkd-trow"><span /><b className="bkd-paidok">Paid in full</b></div> : null}
              </div>
            </div>

            {!cancelled && <RequestActions bookingId={id} staffed={ld?.staffing === "manned"} stageIndex={stage.index} requests={d.requests ?? []} />}

            {purchasedAddons.length > 0 && (
              <div className="tcard bkd-card">
                <h3>Your upgrades</h3>
                <div className="up-list">
                  {purchasedAddons.map((a, i) => {
                    const struck = a.reversedBy != null;
                    const isReversal = a.reversalOf != null;
                    const match = !struck && !isReversal ? reqs.filter((r) => (r.type === "addon" || r.type === "service") && (r.label === a.label)).slice(-1)[0] : null;
                    const amt = Number(a.amount ?? 0);
                    return (
                      <div className={`up-row${struck ? " struck" : ""}${isReversal ? " reversal" : ""}`} key={a.id || i}>
                        <div className="up-main">
                          <b>{a.label || a.name}</b>
                          {struck ? <span className="up-state st-declined">Reversed</span>
                            : isReversal ? <span className="up-state st-done">Credited back</span>
                            : match ? <span className={`up-state st-${match.status}`}>{REQ_STATE[match.status] || match.status}</span>
                            : <span className="up-state st-paid">{amt === 0 ? "Free" : "Added"}</span>}
                        </div>
                        <span className="up-amt">{amt === 0 ? "Free" : `${amt < 0 ? "−" : ""}${cents(Math.abs(amt))}`}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {ongoing && <AddAddon bookingId={id} options={addonOptions} quantity={spaceQty} currency={cur} />}

            {ongoing && Array.isArray(delegations) && <Delegations bookingId={id} items={bookingItems} delegations={delegations} bookingEnd={spaceLine?.endDate} />}

            {addressStr && (
              <div className="tcard bkd-card bkd-where">
                <h3>Where</h3>
                <p className="bkd-address">{addressStr}</p>
                {directionsUrl && (
                  <a className="bkd-directions" href={directionsUrl} target="_blank" rel="noreferrer">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    Get directions
                  </a>
                )}
              </div>
            )}

            {ongoing && (
              <div className="tcard bkd-card">
                <h3>What happens next</h3>
                <ol className="bkd-steps">
                  <li><b>Check in.</b> Drop off at the space following your host’s instructions — they confirm and store your things.</li>
                  <li><b>It’s held &amp; protected.</b> Stowbo-protected up to $5,000 while it’s in their care — take things out and put them back anytime during your booking.</li>
                  <li><b>Check out.</b> Come back in your window to collect, and end your booking when you’re done.</li>
                </ol>
              </div>
            )}

            <div className="tcard bkd-card">
              <h3>Activity</h3>
              <BookingActivity events={timeline?.timeline ?? []} />
            </div>
          </div>

          <aside className="bkd-side">
            {host && <ContactCard role="Host" person={host} subtitle={spaces[0]?.listingTitle} />}

            {!cancelled && instructions && (
              <div className="tcard bkd-instructions">
                <h3>From your host</h3>
                <p className="bkd-instr-text">{instructions}</p>
              </div>
            )}

            {extendable && (
              <div className="tcard bkd-card">
                <h3>Need more time?</h3>
                <ExtendBooking bookingId={String(d.name)} line={spaceIdx} currentEnd={spaceLine.endDate} currency={cur} />
              </div>
            )}

            <div className="tcard bkd-card">
              <h3>Manage</h3>
              <Link className="bkd-link" href={routes.account + "/stuff"}>See what I’ve stored →</Link>
              {ongoing && <CancelBooking bookingId={String(d.name)} refundNote={refundNote} currency={cur} />}
            </div>
          </aside>
        </div>
    </>
  );
}
