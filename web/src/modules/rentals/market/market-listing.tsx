import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { stowbo } from "@/api/rentals";
import { getMapsKey } from "@/modules/rentals/lib/maps";
import { clientCfg, type getMarket } from "./config";
import { imageList, listingReviews, toCard, type MarketEnvelope } from "./api";
import { Gallery } from "./gallery";
import { AvailabilitySection, BookingProvider, ReserveCard, type ReserveListing } from "./reserve";
import { BrowseMap } from "./browse-map";
import { StayCard } from "./stay-card";
import { I, amenityIcon, highlightIcon } from "./icons";
import { addDays, policyText, firstName, initials, money, stars, unitFor } from "./shared";
import "./market.css";

type M = NonNullable<Awaited<ReturnType<typeof getMarket>>>;
const num = (s?: string) => (s && !Number.isNaN(Number(s)) ? Number(s) : undefined);
const STATE: Record<string, string> = { TX: "Texas", OK: "Oklahoma", TN: "Tennessee", NC: "North Carolina", FL: "Florida", CA: "California", IL: "Illinois", LA: "Louisiana" };

export async function marketListingTitle(id: string): Promise<string> {
  const d: any = await stowbo.listing(id).catch(() => null);
  return d?.listing?.data?.title || "Listing";
}

/** A stay / rental listing page: gallery, facts, host, highlights, sleeping, amenities,
 *  availability, reviews, location, rules — and the reserve card priced by the server. */
export async function MarketListing({ m, id, sp }: { m: M; id: string; sp: Record<string, string | undefined> }) {
  const { cfg } = m;
  const detail: any = await stowbo.listing(id).catch(() => null);
  const env = detail?.listing as MarketEnvelope | undefined;
  const d = env?.data;
  if (!env || !d || d.marketRoot || (cfg.vertical && d.vertical !== cfg.vertical)) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const [reviews, cal, mapsKey] = await Promise.all([
    listingReviews(id),
    stowbo.calendar(id, { from: today, days: 400 }).catch(() => null),
    getMapsKey().catch(() => null),
  ]);
  const det = (d.details || {}) as Record<string, any>;
  const unit = unitFor(cfg, d.priceUnit) as "night" | "day" | "hour";
  const images = imageList(d.images);
  const rating = { average: reviews.average, count: reviews.count };
  const card = toCard(cfg, { ...env, rating });
  const host = detail?.host as { id: string; displayName: string; avatar?: string | null; memberSince?: string | null; listingCount?: number | null } | null;
  const hostFirst = firstName(host?.displayName) || "your host";
  // Nights that can't be booked: each existing stay's nights (check-out morning stays open
  // for the next guest), blackouts, and any day the server marks blocked.
  const blockedSet = new Set<string>();
  for (const u of (cal?.upcoming || []) as any[]) {
    for (let day = String(u.startDate).slice(0, 10); day < String(u.endDate).slice(0, 10); day = addDays(day, 1)) blockedSet.add(day);
  }
  for (const x of (cal?.capacityByDay || []) as any[]) if (x.blocked || (!(cal?.upcoming || []).length && Number(x.free) <= 0)) blockedSet.add(String(x.date).slice(0, 10));
  const blocked = [...blockedSet];
  const rates: any = d.rates || {};
  // Minimum stay from the listing's rates (the engine's rule): a night is the 24h after check-in.
  const minimum = unit === "night" ? (rates.minMinutes ? Math.floor(Number(rates.minMinutes) / 1440) + 1 : Number(det.minNights || 1))
    : unit === "hour" ? Math.max(1, Math.round((rates.minMinutes || 60) / 60)) : Math.max(1, Math.round((rates.minMinutes || 1440) / 1440));
  const listing: ReserveListing = { id, title: d.title || "", unit, price: card.price, details: det, minimum, rating, city: d.address?.city || "" };
  const place = [d.address?.city, STATE[String(d.address?.state || "")] || d.address?.state, "United States"].filter(Boolean).join(", ");
  const stays = cfg.experience === "stays";
  const more = ((detail?.moreFromHost || []) as any[]).filter((x) => x.sk !== id);
  const policy = String(d.cancellationPolicy || "moderate");
  const deposit = Number((d as any).payment?.deposit || 0);
  const guests = { adults: num(sp.adults) || 0, children: num(sp.children) || 0, infants: num(sp.infants) || 0, pets: num(sp.pets) || 0 };
  const when = { from: sp.from || null, to: sp.to || null, date: sp.date || null, start: num(sp.start) ?? null, hours: num(sp.hours) ?? null };
  const histMax = Math.max(1, ...Object.values(reviews.histogram || {}));
  const memberYear = host?.memberSince ? new Date(host.memberSince).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : null;
  const ccfg = clientCfg(cfg);

  return (
    <>
      <SiteHeader />
      <main className="mk">
        <BookingProvider listing={listing} blockedDays={blocked} initial={{ when, guests }}>
          <div className="mk-wrap narrow mk-lp">
            <div className="mk-lp-title" style={{ marginBottom: 18 }}>
              <div>
                <h1>{d.title}</h1>
              </div>
            </div>
            <Gallery images={images.length ? images : []} title={d.title || ""} />

            <div className="mk-lp-body">
              <div className="mk-lp-main">
                <section className="mk-lp-kicker">
                  <h2>{stays ? `Entire ${String(det.propertyType || card.typeLabel || "home").toLowerCase()} in ${d.address?.city}, ${d.address?.state}` : [det.brand, det.model].filter(Boolean).join(" ") || card.typeLabel}</h2>
                  <p>{stays ? card.facts.join(" · ") : [card.typeLabel, det.condition ? `${det.condition} condition` : null, `${d.address?.city}, ${d.address?.state}`].filter(Boolean).join(" · ")}</p>
                  <p style={{ marginTop: 6, fontSize: 15 }}>
                    {rating.count > 0 ? (
                      <a href="#reviews" className="mk-star" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>{I.star}{stars(rating.average)} · {rating.count} review{rating.count === 1 ? "" : "s"}</a>
                    ) : <span className="mk-star">{I.star} New listing</span>}
                    {card.badge && <><span className="mk-dot">·</span><b>{card.badge}</b></>}
                  </p>
                </section>

                {host && (
                  <section>
                    <div className="mk-hostrow">
                      <span className="mk-ava">{host.avatar ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={host.avatar} alt="" /> : initials(host.displayName)}</span>
                      <div><b>{cfg.copy.hostedBy} {host.displayName}</b><small>{memberYear ? `On ${m.setup.brand.name} since ${memberYear}` : ""}{host.listingCount && host.listingCount > 1 ? ` · ${host.listingCount} listings` : ""}</small></div>
                    </div>
                  </section>
                )}

                <section>
                    <div className="mk-highlights">
                      {(det.highlights || []).slice(0, 3).map((h: any, i: number) => (
                        <div className="mk-hl" key={i}><i>{highlightIcon(h.icon)}</i><div><b>{h.title}</b><small>{h.body}</small></div></div>
                      ))}
                      <div className="mk-hl"><i>{I.bolt}</i><div><b>Instant Book</b><small>Your dates are confirmed the moment you pay — no waiting for {hostFirst}.</small></div></div>
                      <div className="mk-hl"><i>{I.calendar}</i><div><b>{policy === "flexible" ? `Free cancellation until ${cfg.copy.checkIn.toLowerCase()}` : policy === "strict" ? "Free cancellation up to 48 hours before" : "Free cancellation up to 24 hours before"}</b><small>{policyText(policy, cfg.copy.checkIn)}</small></div></div>
                    </div>
                  </section>

                {d.description && (
                  <section>
                    <h2>{stays ? "About this place" : "About this rental"}</h2>
                    <p className="mk-desc">{d.description}</p>
                  </section>
                )}

                {stays && Array.isArray(det.sleeping) && det.sleeping.length > 0 && (
                  <section>
                    <h2>Where you&apos;ll sleep</h2>
                    <div className="mk-rooms">
                      {det.sleeping.map((r: any, i: number) => <div className="mk-room" key={i}>{I.bed}<b>{r.room}</b><small>{r.beds}</small></div>)}
                    </div>
                  </section>
                )}

                {!stays && Array.isArray(det.includes) && det.includes.length > 0 && (
                  <section>
                    <h2>{cfg.copy.offersTitle}</h2>
                    <div className="mk-amen">{det.includes.map((x: string) => <div key={x}>{I.check}<span>{x}</span></div>)}</div>
                    {det.capacity && <p className="mk-muted" style={{ marginTop: 16 }}>{det.capacity}</p>}
                  </section>
                )}

                {Array.isArray(d.features) && d.features.length > 0 && (
                  <section>
                    <h2>{stays ? cfg.copy.offersTitle : "Good to know"}</h2>
                    <div className="mk-amen">{d.features.map((f: string) => <div key={f}>{amenityIcon(f)}<span>{f}</span></div>)}</div>
                  </section>
                )}

                <AvailabilitySection listing={listing} cfg={ccfg} />
              </div>
              <ReserveCard listing={listing} cfg={ccfg} />
            </div>

            <hr className="mk-hr" />
            <section id="reviews" style={{ scrollMarginTop: 100 }}>
              {reviews.count > 0 ? (
                <>
                  <div className="mk-rv-sum">
                    <span className="big">{stars(reviews.average)}</span>
                    <div><b>{reviews.count} review{reviews.count === 1 ? "" : "s"}</b><p className="mk-muted">{stays ? "from guests who stayed" : `from ${(m.setup.lexicon.customer || "renter").toLowerCase()}s`}</p></div>
                  </div>
                  <div className="mk-rv-bars">
                    {["5", "4", "3", "2", "1"].map((k) => (
                      <div key={k}><span>{k}</span><i><u style={{ width: `${((reviews.histogram?.[k] || 0) / histMax) * 100}%` }} /></i></div>
                    ))}
                  </div>
                  <div className="mk-rvs">
                    {reviews.data.slice(0, 8).map((r) => (
                      <div className="mk-rv" key={r.id}>
                        <div className="mk-rv-who">
                          <span className="mk-ava">{initials(r.author)}</span>
                          <div><b>{r.author}</b><small>{r.at ? new Date(r.at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : ""}</small></div>
                        </div>
                        <div className="mk-rv-stars">{Array.from({ length: 5 }, (_, i) => <span key={i} style={{ opacity: i < r.rating ? 1 : 0.2 }}>{I.star}</span>)}{r.title && <em>{r.title}</em>}</div>
                        <p>{r.message}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mk-rv-sum"><span className="mk-star" style={{ fontSize: 22 }}>{I.star} No reviews yet</span></div>
              )}
            </section>

            <hr className="mk-hr" />
            <section>
              <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>{stays ? "Where you'll be" : unit === "hour" ? "Where it is" : cfg.copy.checkIn}</h2>
              <p style={{ marginBottom: 18 }}>{stays ? place : det.pickup || place}</p>
              {d.location?.lat != null && (
                <div className="mk-lp-map"><BrowseMap single cards={[card]} mapsKey={mapsKey} /></div>
              )}
              {stays && <p className="mk-muted" style={{ marginTop: 12, fontSize: 14 }}>The exact address is shared once your booking is confirmed.</p>}
            </section>

            {host && (
              <>
                <hr className="mk-hr" />
                <section>
                  <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 18 }}>Meet your {(m.setup.lexicon.provider || "host").toLowerCase()}</h2>
                  <div className="mk-box" style={{ maxWidth: 520, display: "flex", gap: 20, alignItems: "center" }}>
                    <span className="mk-ava lg">{initials(host.displayName)}</span>
                    <div>
                      <b style={{ fontSize: 20 }}>{host.displayName}</b>
                      <p className="mk-muted" style={{ fontSize: 14.5 }}>{[rating.count ? `${rating.count} review${rating.count === 1 ? "" : "s"}` : null, rating.average ? `${stars(rating.average)} rating` : null, memberYear ? `Hosting since ${memberYear}` : null].filter(Boolean).join(" · ")}</p>
                      <p style={{ fontSize: 14.5, marginTop: 8 }}>Once you&apos;ve booked you can message {hostFirst} from your {cfg.copy.tripNoun} page.</p>
                    </div>
                  </div>
                </section>
              </>
            )}

            <hr className="mk-hr" />
            <section>
              <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 20 }}>Things to know</h2>
              <div className="mk-rules">
                <div>
                  <h3>{cfg.copy.rulesTitle}</h3>
                  <ul>
                    {stays && det.checkIn && <li>{cfg.copy.checkIn} after {det.checkIn}</li>}
                    {stays && det.checkOut && <li>{cfg.copy.checkOut} before {det.checkOut}</li>}
                    {stays && det.sleeps && <li>{det.sleeps} guests maximum</li>}
                    {!stays && det.pickup && <li>{unit === "hour" ? "Where" : "Pick up"}: {det.pickup}</li>}
                    {!stays && unit !== "hour" && <li>{det.delivery ? "Delivery available — ask the owner" : "Pick up and return in person"}</li>}
                    {(det.houseRules || []).map((r: string) => <li key={r}>{r}</li>)}
                  </ul>
                </div>
                <div>
                  <h3>Cancellation</h3>
                  <ul><li>{policyText(policy, cfg.copy.checkIn)}</li><li>Add your dates to see the exact cut-off.</li></ul>
                </div>
                <div>
                  <h3>Payment</h3>
                  <ul>
                    <li>You pay in full when you book.</li>
                    {deposit > 0 && <li>Plus a {money(deposit)} refundable deposit, released when it comes back in good shape.</li>}
                    <li>Every fee and tax is in the total you see before you pay.</li>
                  </ul>
                </div>
              </div>
            </section>

            {more.length > 0 && (
              <>
                <hr className="mk-hr" />
                <section>
                  <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 18 }}>More from {hostFirst}</h2>
                  <div className="mk-row">
                    {more.map((x) => (
                      <StayCard key={x.sk} href={`/listing/${x.sk}`} c={{
                        id: x.sk, title: x.title || "", type: x.spaceType || "", typeLabel: cfg.types.find((t) => t.id === x.spaceType)?.label || "", city: x.city || "", state: "",
                        image: x.image || null, images: x.image ? [x.image] : [], price: x.price ?? null, unit: unitFor(cfg, x.priceUnit), facts: [], rating: { average: null, count: 0 }, lat: null, lng: null,
                      }} />
                    ))}
                  </div>
                </section>
              </>
            )}
            <p style={{ marginTop: 40 }}><Link className="mk-link" href="/browse">← Back to search</Link></p>
          </div>
        </BookingProvider>
      </main>
      <SiteFooter />
    </>
  );
}
