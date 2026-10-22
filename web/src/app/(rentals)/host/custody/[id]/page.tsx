import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { DashboardShell } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/empty-state";
import { CustodyConsole } from "@/modules/rentals/components/host/custody-console";
import { HostTools } from "@/modules/rentals/components/host/host-tools";
import { BillLines } from "@/modules/rentals/components/host/bill-lines";
import { HandoverPanel } from "@/modules/rentals/components/host/handover-panel";
import { ContactCard } from "@/modules/rentals/components/account/contact-card";
import { BookingTracker } from "@/modules/rentals/components/account/booking-tracker";
import { requireHost } from "@/lib/guards";
import { routes } from "@/lib/nav";
import { getNav } from "@/lib/nav-server";
import { stowbo } from "@/api/rentals";
import { formatMoney } from "@/lib/utils";
import { fmtDate } from "@/lib/dates";
import { bookingStage } from "@/modules/rentals/lib/custody";

export const metadata = { title: "Booking" };

/** The guest on a host-created booking who has no Stowbo account: show what the host
 *  recorded (name / phone / email / note) instead of nothing. `customer` alone may be a
 *  name, a phone or an email — read it for what it looks like. */
function WalkInGuestCard({ d }: { d: any }) {
  const g = (d?.guest ?? {}) as { name?: string; phone?: string; email?: string };
  const raw = String(d?.customer ?? "").trim();
  const looksEmail = /@/.test(raw);
  const looksPhone = /^[+\d][\d\s().-]{6,}$/.test(raw);
  const name = g.name || (!looksEmail && !looksPhone ? raw : "") || "Guest";
  const phone = g.phone || (looksPhone ? raw : "");
  const email = g.email || (looksEmail ? raw : "");
  const note = d?.note as string | undefined;
  const initials = name.split(/\s+/).map((p: string) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <div className="tcard cc">
      <div className="cc-eyebrow">Your guest</div>
      <div className="cc-head">
        <div className="cc-av cc-av-ph" aria-hidden>{initials}</div>
        <div className="cc-id">
          <b className="cc-name">{name}</b>
          <div className="cc-meta"><span>{d?.intakeDoor === "reservation" ? "Reserved at the counter" : "Walk-in"} · no Stowbo account</span></div>
        </div>
      </div>
      {(phone || email) && (
        <div className="cc-actions">
          {phone && <a className="cc-btn cc-btn-primary" href={`tel:${phone.replace(/[^0-9+]/g, "")}`}>Call</a>}
          {email && <a className="cc-btn" href={`mailto:${email}`}>Email</a>}
        </div>
      )}
      {(phone || email || note) && (
        <div className="cc-contact">
          {phone && <div className="cc-row"><span>Phone</span><b>{phone}</b></div>}
          {email && <div className="cc-row"><span>Email</span><b className="cc-email">{email}</b></div>}
          {note && <div className="cc-row"><span>Note</span><b style={{ fontWeight: 500 }}>{note}</b></div>}
        </div>
      )}
      {!phone && !email && !note && <p className="muted" style={{ fontSize: 12.5, margin: "8px 0 0" }}>No phone or email was recorded for this guest.</p>}
    </div>
  );
}

export default async function BookingConsolePage({ params }: { params: Promise<{ id: string }> }) {
  await requireHost();
  const { id } = await params;
  const env = await stowbo.host.booking(id).catch(() => null);

  if (!env) {
    return (
      <>
        <SiteHeader />
        <DashboardShell nav={(await getNav()).provider} title="Booking">
          <EmptyState title="Booking not found" note="It may have been removed, or it isn't for one of your listings." ctaLabel="← All custody" ctaHref={routes.hostCustody} />
        </DashboardShell>
      </>
    );
  }

  const d: any = env.data;
  const firstListing = (d.items ?? [])[0]?.listing;
  const [itemsRes, tl, guestContact, listingEnv, due, delegations] = await Promise.all([
    // Items and passes key on the booking's internal id, not its reference.
    stowbo.host.bookingItems(String(env.sk || id)).catch(() => [] as any[]),
    stowbo.host.timeline(id).catch(() => null),
    stowbo.host.bookingCustomer(id).catch(() => null),
    firstListing ? stowbo.listing(firstListing).catch(() => null) : Promise.resolve(null),
    // What's owed right now incl. a running meter, plus the one-word pay state.
    stowbo.host.due(id).catch(() => null),
    // Pickup passes the owner has sent to other people.
    // null = backend without delegated pickup → no hand-over panel (capability gate).
    stowbo.host.bookingDelegations(String(env.sk || id)).catch(() => null),
  ]);
  const items = Array.isArray(itemsRes) ? itemsRes : [];
  const status = String(d.status ?? "");
  const stage = bookingStage(status, items.map((e) => e.data));
  const cur = d.currency ?? "USD";
  const cents = (n?: number) => formatMoney((n ?? 0) * 100, cur);
  const pay = (env as any).paymentSummary ?? {};
  const canSettle = items.length > 0 && items.every((e) => e.data.status === "ended") && status !== "settled";

  // Add-on lines still standing (not reversed, not a reversal) — for the fulfilment view.
  const purchasedAddons = ((d.items ?? []) as any[]).filter((a) => a.kind === "addon" && a.reversedBy == null && a.reversalOf == null);
  // The space's add-on catalog — what the host can add at the counter.
  const catalog = (((listingEnv as any)?.addOns ?? []) as any[]).map((e) => e?.data ?? e).filter((a) => a?.name && a.status !== "inactive");
  // A released order (cancelled / no-show) or a settled one is closed — no more lines.
  const billEditable = !["cancelled", "no_show", "settled", "completed"].includes(status);
  const reqs = (d.requests ?? []) as any[];
  const HOST_REQ_STATE: Record<string, string> = { open: "Needs you", acknowledged: "You’re on it", ready: "Ready", done: "Done", declined: "Declined" };

  const ld: any = (listingEnv as any)?.listing?.data;
  const addr = ld?.address;
  const addressStr = [addr?.street1, addr?.street2, [addr?.city, addr?.state].filter(Boolean).join(", "), addr?.zip].filter(Boolean).join(", ");
  const loc = ld?.location;
  const dirDest = loc?.lat != null && loc?.lng != null ? `${loc.lat},${loc.lng}` : addressStr;
  const directionsUrl = dirDest ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dirDest)}` : null;

  return (
    <>
      <SiteHeader />
      <DashboardShell nav={(await getNav()).provider} title="Booking" action={<Link className="btn ghost sm" href={routes.hostCustody}>← All custody</Link>}>
        <div className="csl-head">
          <div>
            <h2 className="csl-title">{d.items?.[0]?.listingTitle || "Booking"}</h2>
            <div className="csl-sub">Ref <b>#{d.name}</b> · {d.customerName || d.customer || "Guest"}{env.createdate ? ` · Booked ${fmtDate(env.createdate)}` : ""}</div>
          </div>
          <span className={`bk-status s-${status}`}>{stage.cancelled ? "Cancelled" : stage.index === 2 ? "Collected" : stage.index === 1 ? "In custody" : "Awaiting drop-off"}</span>
        </div>

        {status !== "cancelled" && <BookingTracker stage={stage} />}

        <div className="bkd-grid">
          <div className="bkd-main">
            <CustodyConsole bookingId={id} items={items} timeline={tl} requests={d.requests ?? []} />
            {items.length > 0 && Array.isArray(delegations) && !["cancelled", "no_show", "settled", "completed"].includes(status) && (
              <HandoverPanel bookingId={id} delegations={delegations} itemOrder={items.map((e) => String(e.sk)).sort()} />
            )}
          </div>

          <aside className="bkd-side">
            {guestContact ? <ContactCard role="Guest" person={guestContact} /> : <WalkInGuestCard d={d} />}

            <BillLines bookingId={id} reference={d.name} items={d.items ?? []} currency={cur} due={due} catalog={catalog} editable={billEditable} />
            {(() => {
              const dep = typeof d.deposit === "object" ? d.deposit?.amount : d.deposit;
              if (!dep && d.hostEarning == null && pay.paid == null) return null;
              return (
                <div className="tcard bkd-card">
                  <h3>Money</h3>
                  <div className="bkd-totals" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
                    {dep ? <div className="bkd-trow"><span>Deposit held</span><b>{cents(dep)}</b></div> : null}
                    {d.hostEarning != null ? <div className="bkd-trow bkd-total"><span>Your payout</span><b>{cents(d.hostEarning)}</b></div> : null}
                  </div>
                </div>
              );
            })()}

            {purchasedAddons.length > 0 && (
              <div className="tcard bkd-card">
                <h3>Upgrades bought</h3>
                <div className="up-list">
                  {purchasedAddons.map((a, i) => {
                    const match = reqs.filter((r) => (r.type === "addon" || r.type === "service") && r.label === a.label).slice(-1)[0];
                    return (
                      <div className="up-row" key={a.id || i}>
                        <div className="up-main">
                          <b>{a.label || a.name}</b>
                          {match ? <span className={`up-state st-${match.status}`}>{HOST_REQ_STATE[match.status] || match.status}</span> : <span className="up-state st-paid">{Number(a.amount ?? 0) === 0 ? "Free" : "On the bill"}</span>}
                        </div>
                        <span className="up-amt">{cents(a.amount)}</span>
                      </div>
                    );
                  })}
                </div>
                {purchasedAddons.some((a) => reqs.some((r) => (r.type === "addon" || r.type === "service") && r.label === a.label && r.status !== "done" && r.status !== "declined")) && (
                  <p className="addon-intro" style={{ marginTop: 10, marginBottom: 0 }}>Service upgrades are in your request queue above — acknowledge and mark ready there.</p>
                )}
              </div>
            )}

            <HostTools bookingId={id} canSettle={canSettle} />

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
          </aside>
        </div>
      </DashboardShell>
    </>
  );
}
