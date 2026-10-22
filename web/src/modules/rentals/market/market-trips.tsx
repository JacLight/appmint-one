import Link from "next/link";
import { stowbo } from "@/api/rentals";
import type { Envelope } from "@/lib/api";
import type { getMarket } from "./config";
import { imageList, type MarketEnvelope } from "./api";
import { MessageHost, ReviewForm } from "./trip-actions";
import { CancelBooking } from "@/modules/rentals/components/account/cancel-booking";
import { ExtendBooking } from "@/modules/rentals/components/account/extend-booking";
import { I } from "./icons";
import { clockMinutes, policyText, dayLabel, firstName, initials, money, rangeLabel, timeLabel, unitFor } from "./shared";

const clockLabel24 = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
import "./market.css";

type M = NonNullable<Awaited<ReturnType<typeof getMarket>>>;

interface TripRow {
  id: string; ref: string; status: string; listingId: string; title: string; image: string | null;
  city: string; state: string; start: string | null; end: string | null; total: number; currency: string;
}

function spaceLines(d: any): any[] { return ((d?.items || []) as any[]).filter((it) => !it.kind || it.kind === "space"); }

function tripState(r: { status: string; end: string | null }): { key: "upcoming" | "past" | "cancelled"; label: string; tone: string } {
  if (r.status === "cancelled") return { key: "cancelled", label: "Cancelled", tone: "off" };
  if (r.end && new Date(r.end).getTime() < Date.now()) return { key: "past", label: "Completed", tone: "off" };
  return { key: "upcoming", label: "Confirmed", tone: "ok" };
}

/** My bookings (GET client/stowbo/bookings) that belong to this marketplace — the
 *  shared org also holds Stowbo's — matched to their listing (GET listings/:id). */
async function myTrips(cfg: M["cfg"]): Promise<TripRow[]> {
  const res = await stowbo.myBookings().catch(() => null);
  const rows = (res?.data || []) as Envelope<any>[];
  const ids = Array.from(new Set(rows.flatMap((b) => spaceLines(b.data).map((s) => String(s.listing))).filter(Boolean)));
  const listings = new Map<string, MarketEnvelope>();
  await Promise.all(ids.map(async (id) => { const l: any = await stowbo.listing(id).catch(() => null); if (l?.listing) listings.set(id, l.listing); }));
  return rows.map((b) => {
    const s = spaceLines(b.data)[0];
    const l = s ? listings.get(String(s.listing)) : undefined;
    if (!l || (cfg.vertical && l.data?.vertical !== cfg.vertical)) return null;
    return {
      id: String(b.sk), ref: String(b.data?.name || ""), status: String(b.data?.status || "confirmed"),
      listingId: String(l.sk), title: l.data?.title || s.listingTitle || "", image: imageList(l.data?.images)[0] || null,
      city: l.data?.address?.city || "", state: l.data?.address?.state || "", start: s.startDate || null, end: s.endDate || null,
      total: Number(b.data?.total || 0), currency: b.data?.currency || "USD",
    } as TripRow;
  }).filter(Boolean) as TripRow[];
}

export async function MarketTrips({ m, tab }: { m: M; tab?: string }) {
  const { cfg } = m;
  const trips = await myTrips(cfg);
  const groups = { upcoming: [] as TripRow[], past: [] as TripRow[], cancelled: [] as TripRow[] };
  for (const t of trips) groups[tripState(t).key].push(t);
  groups.upcoming.sort((a, b) => String(a.start).localeCompare(String(b.start)));
  groups.past.sort((a, b) => String(b.start).localeCompare(String(a.start)));
  const active = (tab === "past" || tab === "cancelled" ? tab : "upcoming") as keyof typeof groups;
  const list = groups[active];
  const when = (t: TripRow) => cfg.unit === "night" && t.start && t.end ? rangeLabel(t.start.slice(0, 10), t.end.slice(0, 10)) : `${dayLabel(t.start)}${t.end ? ` – ${dayLabel(t.end)}` : ""}`;

  return (
    <div className="mk mk-acct" style={{ paddingTop: 0 }}>
      <h1>{cfg.copy.tripsTitle}</h1>
      <nav className="mk-tabs">
        {(["upcoming", "past", "cancelled"] as const).map((k) => (
          <Link key={k} href={`/account/bookings${k === "upcoming" ? "" : `?tab=${k}`}`} className={active === k ? "on" : ""}>
            {k === "upcoming" ? "Upcoming" : k === "past" ? "Past" : "Cancelled"}{groups[k].length ? ` (${groups[k].length})` : ""}
          </Link>
        ))}
      </nav>
      {list.length === 0 ? (
        <div className="mk-box" style={{ display: "flex", gap: 24, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ marginBottom: 6 }}>{active === "upcoming" ? `No ${cfg.copy.tripNoun}s booked… yet!` : active === "past" ? `No past ${cfg.copy.tripNoun}s` : `Nothing cancelled`}</h2>
            <p className="mk-muted">{active === "upcoming" ? cfg.copy.emptyTrips : `Your ${cfg.copy.tripNoun}s will show here.`}</p>
          </div>
          <Link className="mk-btn warm" href="/browse">Start searching</Link>
        </div>
      ) : (
        <div className="mk-trips">
          {list.map((t) => {
            const st = tripState(t);
            return (
              <Link className="mk-trip" key={t.id} href={`/account/bookings/${t.id}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {t.image ? <img src={t.image.replace("w=1600", "w=720")} alt="" /> : <div style={{ aspectRatio: "16/10", background: "var(--bg-2)" }} />}
                <div className="b">
                  <span className={`mk-st ${st.tone}`}>{st.label}</span>
                  <b>{t.title}</b>
                  <small>{[t.city, t.state].filter(Boolean).join(", ")} · {when(t)}</small>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export async function MarketTrip({ m, id, booked }: { m: M; id: string; booked?: string }) {
  const { cfg, setup } = m;
  const env = await stowbo.booking(id).catch(() => null);
  const d: any = env?.data;
  const s = spaceLines(d)[0];
  const ldet: any = s ? await stowbo.listing(String(s.listing)).catch(() => null) : null;
  const l = ldet?.listing as MarketEnvelope | undefined;
  if (!d || !s || !l || (cfg.vertical && l.data?.vertical !== cfg.vertical)) {
    return (
      <div className="mk mk-acct" style={{ paddingTop: 0 }}>
        <h1>{cfg.copy.tripsTitle}</h1>
        <div className="mk-box"><h2>We couldn&apos;t find that {cfg.copy.tripNoun}</h2><p className="mk-muted" style={{ marginBottom: 14 }}>It may have been removed, or it isn&apos;t on your account.</p><Link className="mk-btn" href="/account/bookings">Back to {cfg.copy.tripsTitle.toLowerCase()}</Link></div>
      </div>
    );
  }
  const host = await stowbo.bookingHost(id).catch(() => null);
  const ld: any = l.data || {};
  const det = ld.details || {};
  const unit = unitFor(cfg, ld.priceUnit);
  const row = { status: String(d.status || "confirmed"), end: s.endDate || null };
  const st = tripState(row);
  const confirmed = st.key === "upcoming";
  const past = st.key === "past";
  const hostFirst = firstName(host?.name) || "your host";
  const image = imageList(ld.images)[0];
  const addr = ld.address || {};
  const fullAddr = [addr.street1, addr.city, [addr.state, addr.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const mapsHref = ld.location?.lat != null ? `https://www.google.com/maps/search/?api=1&query=${ld.location.lat},${ld.location.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddr)}`;
  const items = ((d.items || []) as any[]).filter((it) => !it.reversedBy);
  const threadHref = host ? `/account/messages/${encodeURIComponent(host.email || host.id)}` : null;
  const policy = String(d.cancellationPolicy?.policy || ld.cancellationPolicy || "moderate");
  const freeUntil = d.cancellationPolicy?.freeUntil;
  const paid = Number(d.payment?.capturedAmount ?? d.payment?.authorizedAmount ?? 0);
  const canReview = past;
  const lineIndex = ((d.items || []) as any[]).indexOf(s);
  // The new end lands on the same clock time the stay already ends at (a house's checkout,
  // or a gear return), so an extension adds whole nights/days rather than ending at midnight.
  const endTime = unit === "night" ? clockLabel24(clockMinutes(det.checkOut, 600)) : (/T\d\d:\d\d/.test(String(s.endDate)) ? String(s.endDate).slice(11, 16) : "10:00");

  return (
    <div className="mk mk-acct" style={{ paddingTop: 0 }}>
      <p style={{ marginBottom: 14 }}><Link className="mk-link" href="/account/bookings">← {cfg.copy.tripsTitle}</Link></p>
      {booked && (
        <div className="mk-ok" style={{ marginBottom: 20, fontSize: 15.5 }}>
          <b>You&apos;re booked.</b> Your confirmation code is {d.name}. We&apos;ve let {hostFirst} know you&apos;re coming.
        </div>
      )}
      <div className="mk-tripx">
        <div>
          <div className="mk-tripx-hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {image && <img src={image} alt="" />}
            <div className="ov">
              <span className={`mk-st ${st.tone}`} style={{ background: "#fff" }}>{st.label}</span>
              <h1>{ld.title}</h1>
              <p>{[addr.city, addr.state].filter(Boolean).join(", ")}{det.propertyType ? ` · ${det.propertyType}` : ""}</p>
            </div>
          </div>

          <div className="mk-ci">
            <div><small>{cfg.copy.checkIn}</small><b>{dayLabel(s.startDate)}</b><span>{unit === "night" ? `After ${det.checkIn || timeLabel(s.startDate)}` : timeLabel(s.startDate)}</span></div>
            <div><small>{cfg.copy.checkOut}</small><b>{dayLabel(s.endDate)}</b><span>{unit === "night" ? `Before ${det.checkOut || timeLabel(s.endDate)}` : timeLabel(s.endDate)}</span></div>
          </div>

          <div className="mk-box">
            <h2>{cfg.experience === "stays" ? "Getting there" : "Pick-up"}</h2>
            {confirmed || past ? (
              <>
                <p style={{ fontSize: 15.5 }}><b>{fullAddr}</b></p>
                <p style={{ marginTop: 6 }}><a className="mk-link" href={mapsHref} target="_blank" rel="noopener">Get directions</a></p>
                {ld.bookingInstructions && <><h3 style={{ marginTop: 18 }}>{cfg.experience === "stays" ? "Check-in instructions" : "Instructions"}</h3><p className="mk-desc" style={{ fontSize: 15 }}>{ld.bookingInstructions}</p></>}
              </>
            ) : st.key === "cancelled" ? <p className="mk-muted">This {cfg.copy.tripNoun} was {st.label.toLowerCase()}.</p>
              : null}
          </div>

          <div className="mk-box">
            <h2>{cfg.experience === "stays" ? "Who's coming" : "Details"}</h2>
            <div className="mk-kv"><span>Confirmation code</span><b>{d.name}</b></div>
            <div className="mk-kv"><span>Booked</span><span>{env?.createdate ? new Date(env.createdate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}</span></div>
          </div>

          {Array.isArray(det.houseRules) && det.houseRules.length > 0 && (
            <div className="mk-box">
              <h2>{cfg.copy.rulesTitle}</h2>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 15, lineHeight: 1.7 }}>{det.houseRules.map((r: string) => <li key={r}>{r}</li>)}</ul>
            </div>
          )}

          {canReview && (
            <div className="mk-box">
              <h2>How was your {cfg.copy.tripNoun}?</h2>
              <ReviewForm listingId={String(l.sk)} bookingId={id} hostFirst={hostFirst} />
            </div>
          )}
        </div>

        <aside>
          {host && (
            <div className="mk-box">
              <div className="mk-hostrow" style={{ marginBottom: 16 }}>
                <span className="mk-ava">{initials(host.name)}</span>
                <div><b>{cfg.copy.hostedBy} {host.name}</b><small>{host.memberSince ? `On ${setup.brand.name} since ${new Date(host.memberSince).toLocaleDateString("en-US", { month: "long", year: "numeric" })}` : ""}</small></div>
              </div>
              {st.key !== "cancelled" ? <MessageHost bookingId={id} hostFirst={hostFirst} threadHref={threadHref} /> : threadHref && <a className="mk-link" href={threadHref}>See messages</a>}
              {host.phone && confirmed && <p style={{ marginTop: 12, fontSize: 14.5 }}>Phone: <a className="mk-link" href={`tel:${host.phone}`}>{host.phone}</a></p>}
            </div>
          )}

          <div className="mk-box">
            <h2>Payment</h2>
            {items.map((it, i) => {
              const space = !it.kind || it.kind === "space";
              const amt = space ? Number(it.subtotal ?? it.amount ?? 0) : Number(it.amount ?? 0);
              if (!amt && !space) return null;
              return <div className="mk-kv" key={i}><span>{space ? (it.rateLabel || `${ld.title}`) : it.label || it.kind}</span><span>{amt < 0 ? "−" : ""}{money(Math.abs(amt), d.currency, true)}</span></div>;
            })}
            <div className="mk-kv tot"><span>Total ({d.currency || "USD"})</span><span>{money(d.total, d.currency, true)}</span></div>
            {paid > 0 && <div className="mk-kv"><span>Paid</span><span>{money(paid, d.currency, true)}</span></div>}
            {Number(d.deposit?.amount) > 0 && (
              <div className="mk-deposit">
                <div className="mk-kv"><span>Refundable deposit</span><span>{money(Number(d.deposit.amount), d.currency, true)}</span></div>
                <p className="mk-muted">{({ held: "Charged with your payment and held until it comes back in good shape.", released: "Released back to your card.", refunded: "Refunded to your card.", captured: "Kept by the owner after the return.", claimed: "Kept by the owner after the return." } as Record<string, string>)[String(d.deposit.status)] || "Held with your payment."}</p>
              </div>
            )}
          </div>

          {st.key === "upcoming" && (
            <div className="mk-box">
              <h2>Cancellation</h2>
              <p style={{ fontSize: 15, marginBottom: 14 }}>
                {freeUntil && new Date(freeUntil).getTime() > Date.now() ? <><b>Free cancellation until {dayLabel(freeUntil, { month: "short", day: "numeric" })}.</b> </> : null}
                {policyText(policy, cfg.copy.checkIn)}
              </p>
              <CancelBooking bookingId={String(env?.sk || id)} currency={d.currency || "USD"} />
            </div>
          )}

          {st.key === "upcoming" && unit !== "hour" && s.startDate && s.endDate && lineIndex >= 0 && (
            <div className="mk-box">
              <h2>{cfg.experience === "stays" ? "Stay longer" : "Keep it longer"}</h2>
              <p className="mk-muted" style={{ fontSize: 14.5, marginBottom: 12 }}>We check the {cfg.experience === "stays" ? "nights" : "days"} are free and tell you the price before your card is charged.</p>
              <ExtendBooking bookingId={String(env?.sk || id)} line={lineIndex} currentEnd={s.endDate} currency={d.currency || "USD"} endTime={endTime} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
