import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSession } from "@/lib/auth";
import { getNav } from "@/lib/nav-server";
import { stowbo, type HostPayout, type HostPayoutMethod, type HostWallet } from "@/api/rentals";
import { ApplyHostButton } from "@/modules/rentals/components/host/apply-button";
import { PayoutMethods } from "@/modules/rentals/components/host/payout-methods";
import { CashOut } from "@/modules/rentals/components/account/cash-out";
import { clientCfg, type getMarket } from "./config";
import { hostTrips, imageList, listingFees, myMarketListings, searchMarket, type HostTripRow, type MarketEnvelope } from "./api";
import { HostCalendar, ListingEditor, StatusToggle, type HCalDay } from "./host-client";
import type { MarketListingForm } from "./actions";
import { I } from "./icons";
import { dayLabel, firstName, money, rangeLabel, unitFor } from "./shared";
import "./market.css";

type M = NonNullable<Awaited<ReturnType<typeof getMarket>>>;

function when(r: HostTripRow, unit: string) {
  if (!r.start) return "";
  return unit === "night" && r.end ? rangeLabel(r.start.slice(0, 10), r.end.slice(0, 10)) : `${dayLabel(r.start)}${r.end ? ` – ${dayLabel(r.end)}` : ""}`;
}
function rowState(r: HostTripRow): { key: "upcoming" | "current" | "past" | "cancelled"; label: string; tone: string } {
  const now = Date.now();
  if (r.status === "cancelled") return { key: "cancelled", label: "Cancelled", tone: "off" };
  if (r.end && new Date(r.end).getTime() < now) return { key: "past", label: "Completed", tone: "off" };
  if (r.start && new Date(r.start).getTime() <= now) return { key: "current", label: "Hosting now", tone: "ok" };
  return { key: "upcoming", label: "Confirmed", tone: "ok" };
}

function ResRows({ rows, unit, noun }: { rows: HostTripRow[]; unit: string; noun: string }) {
  return (
    <div className="mk-res">
      {rows.map((r) => {
        const st = rowState(r);
        return (
          <div className="mk-resrow" key={r.booking}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {r.image ? <img src={r.image.replace("w=1600", "w=240")} alt="" /> : <span />}
            <div><span className={`mk-st ${st.tone}`} style={{ marginBottom: 4 }}>{st.label}</span><b>{r.guest.name}</b><small>{r.listingTitle}</small></div>
            <div className="when"><b style={{ fontWeight: 500 }}>{when(r, unit)}</b><small>{r.reference ? `#${r.reference}` : ""}</small></div>
            <div className="amt"><b>{money(r.total, r.currency, true)}</b><small>{r.paymentStatus === "paid" || r.paymentStatus === "captured" ? "Paid" : r.paymentStatus || ""}</small></div>
            <div className="acts"><Link className="mk-btn sm quiet" href={r.guest.email ? `/host/messages/${encodeURIComponent(r.guest.email)}` : "/host/messages"}>Message</Link></div>
          </div>
        );
      })}
      {rows.length === 0 && <div className="mk-box" style={{ textAlign: "center" }}><p className="mk-muted">No {noun}s here yet.</p></div>}
    </div>
  );
}

async function shell(title: string, children: React.ReactNode, action?: React.ReactNode) {
  return (
    <>
      <SiteHeader />
      <DashboardShell nav={(await getNav()).provider} title={title} action={action}>
        <div className="mk">{children}</div>
      </DashboardShell>
    </>
  );
}

/** /host — the pitch for everyone else, Today for an approved host. */
export async function MarketHostHome({ m }: { m: M }) {
  const { cfg, setup } = m;
  const session = await getSession();
  if (!session.signedIn || !session.host) {
    const me: any = session.signedIn ? await stowbo.host.me().catch(() => null) : null;
    const pick = await searchMarket(cfg, { sort: "rating" }).catch(() => null);
    const photo = (pick?.rows || []).map((r) => imageList(r.data?.images)[1] || imageList(r.data?.images)[0]).filter(Boolean)[2];
    return (
      <>
        <SiteHeader />
        <main className="mk">
          <div className="mk-wrap">
            <div className="mk-pitch">
              <div>
                <h1>{cfg.copy.hostPitch}</h1>
                <p>{cfg.copy.hostPitchSub}</p>
                {me?.applied && !me?.approved ? (
                  <div className="mk-box" style={{ maxWidth: 460 }}><h3>Application received</h3><p className="mk-muted">We&apos;re reviewing it now — you&apos;ll hear from us by email.</p></div>
                ) : session.signedIn ? <ApplyHostButton /> : (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Link className="mk-btn warm lg" href="/signup?next=/host">Get started</Link>
                    <Link className="mk-btn ghost lg" href="/login?next=/host">I already have an account</Link>
                  </div>
                )}
                <ul style={{ marginTop: 28, paddingLeft: 18, color: "var(--text-2)", lineHeight: 1.9 }}>
                  <li>You set the {cfg.unit === "night" ? "nightly" : "daily"} price, the minimum {cfg.unit === "night" ? "stay" : "rental"} and the rules.</li>
                  <li>Bookings are confirmed and paid the moment a {(setup.lexicon.customer || "guest").toLowerCase()} books; block any dates you want to keep.</li>
                  <li>{setup.lexicon.customer || "Guest"}s pay up front; you cash out to your bank.</li>
                </ul>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {photo && <img src={photo} alt="" />}
            </div>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const [rows, listings, wallet] = await Promise.all([hostTrips(cfg), myMarketListings(cfg), stowbo.host.wallet().catch(() => null) as Promise<HostWallet | null>]);
  const current = rows.filter((r) => rowState(r).key === "current");
  const upcoming = rows.filter((r) => rowState(r).key === "upcoming");
  const name = firstName(session.customer?.firstName) || "there";
  return shell(`Welcome back, ${name}`, (
    <>
      <div className="mk-stats">
        <div className="mk-stat"><small>{cfg.experience === "stays" ? "Hosting now" : "Out now"}</small><b>{current.length}</b><Link href="/host/reservations">See all</Link></div>
        <div className="mk-stat"><small>Upcoming {cfg.copy.tripNoun}s</small><b>{upcoming.length}</b><Link href="/host/reservations">See all</Link></div>
        <div className="mk-stat"><small>Available to pay out</small><b>{money(wallet?.available ?? 0, wallet?.currency || "USD")}</b><Link href="/host/payouts">Payouts</Link></div>
        <div className="mk-stat"><small>Listings</small><b>{listings.length}</b><Link href="/host/listings">Manage</Link></div>
      </div>
      {listings.length === 0 && (
        <div className="mk-box" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 26 }}>
          <div><h2 style={{ marginBottom: 4 }}>Create your first listing</h2><p className="mk-muted">It takes about ten minutes. You can pause it any time.</p></div>
          <Link className="mk-btn warm" href="/host/listings/new">Create listing</Link>
        </div>
      )}
      <h2 style={{ fontSize: 20, margin: "26px 0 14px" }}>{current.length ? "Hosting now" : "Coming up"}</h2>
      <ResRows rows={(current.length ? current : upcoming).slice(0, 6)} unit={cfg.unit} noun={cfg.copy.tripNoun} />
    </>
  ), <Link className="mk-btn sm" href="/host/listings/new">+ New listing</Link>);
}

export async function MarketReservations({ m, tab }: { m: M; tab?: string }) {
  const { cfg } = m;
  const rows = await hostTrips(cfg);
  const g = { upcoming: [] as HostTripRow[], past: [] as HostTripRow[], cancelled: [] as HostTripRow[] };
  for (const r of rows) {
    const k = rowState(r).key;
    (k === "upcoming" || k === "current" ? g.upcoming : k === "past" ? g.past : g.cancelled).push(r);
  }
  g.past.reverse();
  const active = (["upcoming", "past", "cancelled"].includes(String(tab)) ? tab : "upcoming") as keyof typeof g;
  const label = { upcoming: "Upcoming", past: "Completed", cancelled: "Cancelled" };
  return shell("Reservations", (
    <>
      <nav className="mk-tabs">
        {(Object.keys(g) as (keyof typeof g)[]).map((k) => (
          <Link key={k} href={`/host/reservations?tab=${k}`} className={active === k ? "on" : ""}>{label[k]}{g[k].length ? ` (${g[k].length})` : ""}</Link>
        ))}
      </nav>
      <ResRows rows={g[active]} unit={cfg.unit} noun={cfg.copy.tripNoun} />
    </>
  ));
}

export async function MarketHostCalendar({ m, listing, month }: { m: M; listing?: string; month?: string }) {
  const { cfg } = m;
  const mine = await myMarketListings(cfg);
  if (!mine.length) return shell("Calendar", <div className="mk-box"><h2>No listings yet</h2><p className="mk-muted" style={{ marginBottom: 14 }}>Your calendar appears once you have a listing.</p><Link className="mk-btn" href="/host/listings/new">Create listing</Link></div>);
  // Default to the listing with the next arrival, so the calendar opens on something happening.
  const trips = await hostTrips(cfg);
  const soon = listing ? null : trips.find((r) => r.status !== "cancelled" && r.end && new Date(r.end).getTime() > Date.now());
  const sel = mine.find((l) => String(l.sk) === (listing || soon?.listingId)) || mine[0];
  const today = new Date().toISOString().slice(0, 10);
  const mon = month && /^\d{4}-\d{2}$/.test(month) ? month : today.slice(0, 7);
  const first = new Date(`${mon}-01T12:00:00Z`);
  const dim = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cal = await stowbo.host.calendar(String(sel.sk), { from: `${mon}-01`, days: dim + 1 }).catch(() => null);
  const byDay = new Map((cal?.capacityByDay || []).map((x) => [String(x.date).slice(0, 10), x]));
  const guestOn = (day: string) => (cal?.upcoming || []).find((u) => u.startDate.slice(0, 10) <= day && u.endDate.slice(0, 10) > day);
  const blackOn = (day: string) => (cal?.blackouts || []).find((b) => String(b.from).slice(0, 10) <= day && String(b.to).slice(0, 10) > day);
  const days: HCalDay[] = Array.from({ length: dim }, (_, i) => {
    const date = `${mon}-${String(i + 1).padStart(2, "0")}`;
    const c = byDay.get(date);
    const u = guestOn(date);
    const bl = blackOn(date);
    const state: HCalDay["state"] = date < today ? "past" : bl || c?.blocked ? "blocked" : u ? "booked" : "free";
    const who = u?.booking ? trips.find((t) => t.booking === u.booking)?.guest.name : null;
    return { date, state, guest: who ? firstName(who) : u ? "Booked" : undefined, booking: u?.booking, blackout: bl?.id };
  });
  const prev = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1)).toISOString().slice(0, 7);
  const label = first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const unit = unitFor(cfg, sel.data?.priceUnit);
  return shell("Calendar", (
    <>
      <div className="mk-chiprow" style={{ marginBottom: 18 }}>
        {mine.map((l) => <Link key={l.sk} className={`mk-chip${l.sk === sel.sk ? " on" : ""}`} href={`/host/calendar?listing=${l.sk}&m=${mon}`}>{l.data?.title}</Link>)}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <Link className="mk-cal-nav" href={`/host/calendar?listing=${sel.sk}&m=${prev}`} aria-label="Previous month">{I.left}</Link>
        <h2 style={{ fontSize: 20 }}>{label}</h2>
        <Link className="mk-cal-nav" href={`/host/calendar?listing=${sel.sk}&m=${next}`} aria-label="Next month">{I.right}</Link>
      </div>
      <HostCalendar listingId={String(sel.sk)} days={days} lead={first.getUTCDay()} price={typeof sel.data?.price === "number" ? sel.data.price : null} unit={unit} />
    </>
  ));
}

export async function MarketHostListings({ m }: { m: M }) {
  const { cfg } = m;
  const mine = await myMarketListings(cfg);
  return shell("Listings", mine.length === 0 ? (
    <div className="mk-box"><h2>No listings yet</h2><p className="mk-muted" style={{ marginBottom: 14 }}>{cfg.copy.hostPitchSub}</p><Link className="mk-btn warm" href="/host/listings/new">Create listing</Link></div>
  ) : (
    <div className="mk-lcards">
      {mine.map((l) => {
        const d: any = l.data || {};
        const img = imageList(d.images)[0];
        const unit = unitFor(cfg, d.priceUnit);
        return (
          <div className="mk-lcard" key={l.sk}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {img ? <img src={img.replace("w=1600", "w=640")} alt="" /> : <div style={{ aspectRatio: "4/3", background: "var(--bg-2)" }} />}
            <div className="b">
              <span className={`mk-st ${d.status === "active" ? "ok" : "off"}`}>{d.status === "active" ? "Listed" : d.status === "paused" ? "Paused" : "Draft"}</span>
              <b>{d.title}</b>
              <small>{[d.address?.city, d.address?.state].filter(Boolean).join(", ")} · {money(d.price)} {unit}</small>
              <div className="row">
                <Link className="mk-btn sm" href={`/host/listings/${l.sk}/edit`}>Edit</Link>
                <Link className="mk-btn sm quiet" href={`/host/calendar?listing=${l.sk}`}>Calendar</Link>
                <StatusToggle id={String(l.sk)} status={String(d.status)} />
                <Link className="mk-btn sm quiet" href={`/listing/${l.sk}`}>View</Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  ), <Link className="mk-btn sm" href="/host/listings/new">+ New listing</Link>);
}

function blankForm(m: M): MarketListingForm {
  const { cfg } = m;
  return {
    vertical: cfg.vertical || "", market: cfg.market, unit: cfg.unit === "night" ? "night" : "day",
    title: "", spaceType: cfg.types[0]?.id || "", description: "", bookingInstructions: "",
    address: { country: "US" }, location: null, features: [], images: [],
    price: 0, minimum: cfg.unit === "night" ? 2 : 1, cleaningFee: cfg.unit === "night" ? 0 : undefined, deposit: 0,
    cancellationPolicy: "moderate", taxRate: undefined,
    details: cfg.unit === "night" ? { checkIn: "4:00 PM", checkOut: "10:00 AM", pets: false, houseRules: ["No parties or events", "No smoking"] } : {},
  };
}

export async function MarketListingEdit({ m, id, created }: { m: M; id: string | null; created?: boolean }) {
  const { cfg } = m;
  let form = blankForm(m);
  if (id) {
    const det: any = await stowbo.host.listing(id).catch(() => null);
    const env = det?.listing as MarketEnvelope | undefined;
    const d: any = env?.data;
    if (!d || d.vertical !== cfg.vertical) notFound();
    const fees = await listingFees(id);
    const clean = fees.find((f) => /clean|prep/i.test(String(f?.data?.title || f?.data?.name)));
    const unit = unitFor(cfg, d.priceUnit) as "night" | "day" | "hour";
    const mm = Number(d.rates?.minMinutes || 0);
    form = {
      ...form, unit, title: d.title || "", spaceType: d.spaceType || form.spaceType, description: d.description || "", bookingInstructions: d.bookingInstructions || "",
      address: d.address || {}, location: d.location || null, features: d.features || [], images: imageList(d.images),
      price: Number(d.price || d.rates?.bands?.[0]?.amount || 0),
      minimum: unit === "night" ? (mm ? Math.floor(mm / 1440) + 1 : Number(d.details?.minNights || 1)) : unit === "hour" ? Math.max(1, Math.round(mm / 60)) : Math.max(1, Math.round(mm / 1440)),
      cleaningFee: unit === "night" ? Number(clean?.data?.amount || 0) : undefined, deposit: Number(d.payment?.deposit || 0),
      cancellationPolicy: d.cancellationPolicy || "moderate",
      taxRate: typeof d.taxRate === "number" ? d.taxRate : undefined, details: d.details || {}, status: d.status,
    };
  }
  return shell(id ? "Edit listing" : "New listing", (
    <>
      {created && <p className="mk-ok" style={{ marginBottom: 16 }}>Your listing is live. Guests can find it in search now.</p>}
      <ListingEditor cfg={clientCfg(cfg)} vertical={cfg.vertical || ""} market={cfg.market} initial={form} id={id} />
    </>
  ));
}

export async function MarketPayouts({ m }: { m: M }) {
  void m;
  const [hwR, payoutsR, methodsR] = await Promise.allSettled([stowbo.host.wallet(), stowbo.host.payouts(), stowbo.host.payoutMethods()]);
  const hw = (hwR.status === "fulfilled" ? hwR.value : null) as HostWallet | null;
  const payouts = (payoutsR.status === "fulfilled" && Array.isArray(payoutsR.value) ? payoutsR.value : []) as HostPayout[];
  const methods = (methodsR.status === "fulfilled" && Array.isArray(methodsR.value) ? methodsR.value : null) as HostPayoutMethod[] | null;
  const cur = hw?.currency || "USD";
  const STATE: Record<string, string> = { requested: "Pending", pending: "Pending", processing: "Processing", paid: "Paid", completed: "Paid", failed: "Failed", cancelled: "Cancelled", rejected: "Rejected" };
  return shell("Payouts", (
    <>
      <div className="mk-box" style={{ background: "var(--primary)", color: "#fff", borderColor: "var(--primary)" }}>
        <small style={{ opacity: .8, fontSize: 13.5 }}>Available to pay out</small>
        <div style={{ fontSize: 40, fontWeight: 700, margin: "4px 0 6px", letterSpacing: "-.01em" }}>{money(hw?.available ?? 0, cur, true)}</div>
        <p style={{ opacity: .85, fontSize: 14, marginBottom: 14 }}>What guests have paid for completed and confirmed bookings, less refunds and payouts already sent.{hw?.minPayout ? ` Minimum payout ${money(hw.minPayout, cur)}.` : ""}</p>
        <CashOut available={hw?.available ?? 0} currency={cur} minimum={hw?.minPayout ?? 0} methods={methods} />
      </div>
      <div className="mk-stats" style={{ marginTop: 20 }}>
        <div className="mk-stat"><small>Earned to date</small><b>{money(hw?.earned ?? 0, cur)}</b></div>
        <div className="mk-stat"><small>Upcoming from bookings</small><b>{money(hw?.expectedFromBookings ?? 0, cur)}</b></div>
        <div className="mk-stat"><small>Paid out</small><b>{money(hw?.paidOut ?? 0, cur)}</b></div>
        <div className="mk-stat"><small>Refunded</small><b>{money(hw?.refunded ?? 0, cur)}</b></div>
      </div>
      {methods && <div style={{ marginBottom: 24 }}><PayoutMethods methods={methods} /></div>}
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Payout history</h2>
      {payouts.length === 0 ? <div className="mk-box"><p className="mk-muted">No payouts yet — cash out above when you&apos;re ready.</p></div> : (
        <div className="mk-box">
          {payouts.map((p) => (
            <div className="mk-kv" key={p.id}>
              <span>{p.at ? dayLabel(p.at, { month: "short", day: "numeric", year: "numeric" }) : ""} · {p.destination ? [p.destination.label, p.destination.detail].filter(Boolean).join(" · ") : p.method || "Bank"}</span>
              <span><span className={`mk-st ${["paid", "completed"].includes(p.status) ? "ok" : ["failed", "cancelled", "rejected"].includes(p.status) ? "off" : "wait"}`} style={{ marginRight: 10, marginBottom: 0 }}>{STATE[p.status] || p.status}</span>{money(p.amount, p.currency || cur, true)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  ));
}
