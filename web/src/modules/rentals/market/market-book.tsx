import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getSession } from "@/lib/auth";
import { stowbo } from "@/api/rentals";
import { requireMarket } from "./config";
import { imageList, listingReviews, toMarketQuote, type MarketEnvelope } from "./api";
import { BookForm } from "./book-form";
import { QuoteLines } from "./reserve";
import { I } from "./icons";
import { policyText, clockLabel, dayLabel, firstName, money, rangeLabel, stars, timeLabel, unitFor, whenQuery, windowFor } from "./shared";
import "./market.css";

const num = (s?: string) => (s && !Number.isNaN(Number(s)) ? Number(s) : undefined);

/** "Confirm and pay": the trip, a message to the host, the card, and the server's
 *  price for exactly these dates (POST checkout/quote). */
export async function MarketBook({ id, sp }: { id: string; sp: Record<string, string | undefined> }) {
  const { cfg } = await requireMarket();
  const [detail, session] = await Promise.all([stowbo.listing(id).catch(() => null) as Promise<any>, getSession()]);
  const env = detail?.listing as MarketEnvelope | undefined;
  const d = env?.data;
  if (!env || !d || d.marketRoot || (cfg.vertical && d.vertical !== cfg.vertical)) notFound();
  const det = (d.details || {}) as Record<string, any>;
  const unit = unitFor(cfg, d.priceUnit);
  const when = { from: sp.from || null, to: sp.to || null, date: sp.date || null, start: num(sp.start) ?? null, hours: num(sp.hours) ?? null };
  const guests = { adults: num(sp.adults) || (cfg.guests ? 1 : 0), children: num(sp.children) || 0, infants: num(sp.infants) || 0, pets: num(sp.pets) || 0 };
  const win = windowFor(unit, when, det);
  const back = `/listing/${id}?${whenQuery(when, cfg.guests ? guests : undefined)}`;
  const hostFirst = firstName(detail?.host?.displayName) || "your host";

  const [quoteRaw, reviews, gateways] = await Promise.all([
    win ? stowbo.quote({ items: [{ listing: id, startDate: win.startDate, endDate: win.endDate, quantity: 1 }], currency: "USD" }).catch((e: any) => ({ __err: e?.response?.data?.error || e?.message })) : null,
    listingReviews(id),
    stowbo.paymentGateways().catch(() => []),
  ]);
  const qErr = (quoteRaw as any)?.__err as string | undefined;
  const quote = qErr ? null : toMarketQuote(quoteRaw as any);
  const stripe = (gateways || []).map((g: any) => g?.data ?? g).find((x: any) => x?.provider === "stripe" || /stripe/i.test(x?.name ?? ""));
  const testMode = String(stripe?.publishableKey || "").startsWith("pk_test_");
  const img = imageList(d.images)[0];
  const ok = !!win && !!quote && quote.bookable !== false;
  const policy = String(d.cancellationPolicy || "moderate");
  const deposit = Number((d as any).payment?.deposit || 0);
  const nGuests = guests.adults + guests.children;
  const datesText = unit === "hour" && win ? `${dayLabel(win.startDate, { weekday: "short", month: "short", day: "numeric" })}, ${timeLabel(win.startDate)} – ${timeLabel(win.endDate)}` : when.from && when.to ? rangeLabel(when.from, when.to) : "";
  const title = "Confirm and pay";

  return (
    <>
      <SiteHeader />
      <main className="mk">
        <div className="mk-wrap narrow mk-book">
          <div className="mk-book-top">
            <Link href={back} aria-label="Back">{I.left}</Link>
            <h1>{title}</h1>
          </div>
          <div className="mk-book-grid">
            <div className="mk-book-main">
              <section>
                <h2>Your {cfg.copy.tripNoun}</h2>
                <div className="mk-trip-row"><div><b>{unit === "hour" ? "Date and time" : "Dates"}</b><span>{datesText || "Choose your dates"}</span></div><Link className="mk-link" href={back}>Edit</Link></div>
                {cfg.guests && <div className="mk-trip-row"><div><b>Guests</b><span>{nGuests} guest{nGuests === 1 ? "" : "s"}{guests.infants ? `, ${guests.infants} infant${guests.infants === 1 ? "" : "s"}` : ""}{guests.pets ? `, ${guests.pets} pet${guests.pets === 1 ? "" : "s"}` : ""}</span></div><Link className="mk-link" href={back}>Edit</Link></div>}
                {cfg.experience === "stays" && det.checkIn && <div className="mk-trip-row"><div><b>{cfg.copy.checkIn} / {cfg.copy.checkOut.toLowerCase()}</b><span>After {det.checkIn} · before {det.checkOut}</span></div></div>}
                {cfg.experience !== "stays" && det.pickup && <div className="mk-trip-row"><div><b>{cfg.copy.checkIn}</b><span>{det.pickup}</span></div></div>}
              </section>

              <section>
                <h2>Cancellation policy</h2>
                <p style={{ fontSize: 15.5 }}>
                  {quote?.freeUntil ? <><b>Free cancellation before {dayLabel(quote.freeUntil, { month: "short", day: "numeric" })}{unit !== "night" ? ` at ${clockLabel(new Date(quote.freeUntil).getUTCHours() * 60 + new Date(quote.freeUntil).getUTCMinutes())}` : ""}.</b> </> : null}
                  {policyText(policy, cfg.copy.checkIn)}
                </p>
              </section>

              {Array.isArray(det.houseRules) && det.houseRules.length > 0 && (
                <section>
                  <h2>{cfg.copy.rulesTitle}</h2>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 15, lineHeight: 1.7 }}>{det.houseRules.map((r: string) => <li key={r}>{r}</li>)}</ul>
                </section>
              )}

              {!ok ? (
                <section>
                  <p className="mk-err">{qErr || (win ? `Those dates aren't available — they're booked or blocked by ${hostFirst}. Pick other dates.` : "Choose your dates first.")}</p>
                  <Link className="mk-btn ghost" style={{ marginTop: 14 }} href={back}>Change dates</Link>
                </section>
              ) : !session.signedIn ? (
                <section>
                  <h2>Log in or sign up to book</h2>
                  <p className="mk-muted" style={{ marginBottom: 14 }}>Your dates and price stay just as they are.</p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Link className="mk-btn warm lg" href={`/login?next=${encodeURIComponent(`/reserve/${id}?${whenQuery(when, cfg.guests ? guests : undefined)}`)}`}>Log in</Link>
                    <Link className="mk-btn ghost lg" href={`/signup?next=${encodeURIComponent(`/reserve/${id}?${whenQuery(when, cfg.guests ? guests : undefined)}`)}`}>Sign up</Link>
                  </div>
                </section>
              ) : (
                <BookForm listingId={id} startDate={win!.startDate} endDate={win!.endDate} guests={cfg.guests ? guests : undefined} hostFirst={hostFirst}
                  actionLabel="Confirm and pay" testMode={testMode} total={quote!.total} deposit={deposit} />
              )}
            </div>

            <aside className="mk-book-side">
              <div className="lst">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {img && <img src={img.replace("w=1600", "w=400")} alt="" />}
                <div>
                  <small>{det.propertyType || cfg.types.find((t) => t.id === d.spaceType)?.label}</small>
                  <b>{d.title}</b>
                  {reviews.count > 0 && <span className="mk-star" style={{ fontSize: 13.5 }}>{I.star}{stars(reviews.average)} <span className="mk-muted" style={{ fontWeight: 400 }}>({reviews.count})</span></span>}
                </div>
              </div>
              <h3>Price details</h3>
              {quote && ok ? <QuoteLines q={quote} price={typeof d.price === "number" ? d.price : null} unit={unit} /> : <p className="mk-muted">{win ? "Pick available dates to see the price." : "Add your dates to see the price."}</p>}
              {deposit > 0 && quote && ok && (
                <div className="mk-deposit">
                  <div className="mk-kv"><span>Refundable deposit</span><span>{money(deposit, quote.currency)}</span></div>
                  <p className="mk-muted">Charged today with the total above and released when it comes back in good shape.</p>
                </div>
              )}
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
