"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientCfg } from "./config";
import { I } from "./icons";
import { RangeCalendar } from "./range-calendar";
import { GuestCounters, guestsLabel, type Guests } from "./search-bar";
import { quoteStayAction } from "./actions";
import {
  clockLabel, dayLabel, money, nightsBetween, rangeLabel, spanLabel, stars, whenQuery, windowFor,
  type MarketQuote, type Rating, type WhenParams,
} from "./shared";

export interface ReserveListing {
  id: string; title: string; unit: "night" | "day" | "hour"; price: number | null;
  details: Record<string, any>; minimum: number; rating: Rating; city: string;
}

interface Ctx {
  when: WhenParams; setWhen: (w: WhenParams) => void;
  guests: Guests; setGuests: (g: Guests) => void;
  quote: MarketQuote | null; quoting: boolean; error: string | null;
  blocked: Set<string>;
}
const C = createContext<Ctx | null>(null);
const useB = () => useContext(C)!;

/** Holds the chosen dates/guests for a listing page and asks the server for the price. */
export function BookingProvider({ listing, blockedDays, initial, children }: {
  listing: ReserveListing; blockedDays: string[]; initial: { when: WhenParams; guests: Guests }; children: React.ReactNode;
}) {
  const [when, setWhen] = useState<WhenParams>(initial.when);
  const [guests, setGuests] = useState<Guests>(initial.guests.adults ? initial.guests : { ...initial.guests, adults: listing.unit === "night" ? 1 : 0 });
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = useMemo(() => new Set(blockedDays), [blockedDays]);
  const seq = useRef(0);

  useEffect(() => {
    const win = windowFor(listing.unit, when, listing.details);
    if (!win) { setQuote(null); setError(null); return; }
    const n = ++seq.current;
    setQuoting(true); setError(null);
    quoteStayAction(listing.id, win.startDate, win.endDate).then((r) => {
      if (n !== seq.current) return;
      setQuoting(false);
      if (r.ok) { setQuote(r.quote); setError(r.quote.bookable === false ? (r.quote.reason || "Those dates aren't available.") : null); }
      else { setQuote(null); setError(r.error); }
    });
    // Keep the URL in step so a refresh or a shared link keeps the dates.
    const qs = whenQuery(when, listing.unit === "night" ? guests : undefined);
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, [listing.id, listing.unit, listing.details, when, guests]);

  return <C.Provider value={{ when, setWhen, guests, setGuests, quote, quoting, error, blocked }}>{children}</C.Provider>;
}

/** The server's breakdown, row for row. */
export function QuoteLines({ q, price, unit }: { q: MarketQuote; price?: number | null; unit: string }) {
  const span = spanLabel(q.rateMinutes, unit);
  const n = unit === "hour" ? Math.ceil((q.rateMinutes || 0) / 60) : Math.ceil((q.rateMinutes || 0) / 1440);
  const baseLabel = price != null && span && Math.abs(price * n - (q.base ?? 0)) < 0.01 ? `${money(price)} × ${span}` : [q.rateLabel, span].filter(Boolean).join(" · ");
  return (
    <div className="mk-lines">
      <div><span>{baseLabel}</span><span>{money(q.base ?? q.subtotal, q.currency)}</span></div>
      {q.fees.filter((f) => f.by !== "tax").map((f, i) => <div key={i}><span>{f.label}</span><span>{money(f.amount, q.currency)}</span></div>)}
      {!!q.discount && <div className="disc"><span>Discount</span><span>−{money(q.discount, q.currency)}</span></div>}
      {!!q.tax && <div><span>Taxes</span><span>{money(q.tax, q.currency)}</span></div>}
      <div className="tot"><span>Total</span><span>{money(q.total, q.currency)}</span></div>
    </div>
  );
}

function WhenPicker({ listing, cfg, onDone, months = 2 }: { listing: ReserveListing; cfg: ClientCfg; onDone?: () => void; months?: 1 | 2 }) {
  const { when, setWhen, blocked } = useB();
  if (listing.unit === "hour") {
    const min = Math.max(1, listing.minimum);
    return (
      <div>
        <RangeCalendar single months={1} from={when.date} to={when.date} blocked={blocked} onChange={(d) => setWhen({ ...when, date: d, start: when.start ?? 18 * 60, hours: when.hours ?? min })} />
        <div className="mk-form" style={{ marginTop: 14 }}>
          <div className="two">
            <label>Start
              <select value={when.start ?? 18 * 60} onChange={(e) => setWhen({ ...when, start: Number(e.target.value) })}>
                {Array.from({ length: 15 }, (_, i) => (8 + i) * 60).map((m) => <option key={m} value={m}>{clockLabel(m)}</option>)}
              </select>
            </label>
            <label>Hours
              <select value={when.hours ?? min} onChange={(e) => setWhen({ ...when, hours: Number(e.target.value) })}>
                {Array.from({ length: 12 - min + 1 }, (_, i) => min + i).map((h) => <option key={h} value={h}>{h} hours</option>)}
              </select>
            </label>
          </div>
        </div>
        {onDone && <div className="close"><button type="button" className="mk-btn sm" onClick={onDone}>Done</button></div>}
      </div>
    );
  }
  return (
    <div>
      <RangeCalendar months={months} from={when.from} to={when.to} blocked={blocked} minNights={listing.minimum}
        onChange={(f, t) => { setWhen({ ...when, from: f, to: t }); if (f && t) onDone?.(); }} />
      <div className="mk-cal-foot">
        <small>{listing.minimum > 1 ? `Minimum ${listing.minimum} ${listing.unit === "night" ? "nights" : "days"}` : ""}</small>
        <button type="button" className="mk-link" onClick={() => setWhen({ ...when, from: null, to: null })}>Clear dates</button>
      </div>
    </div>
  );
}

/** Sticky reserve card (desktop) + fixed bottom bar and sheet (phone). */
export function ReserveCard({ listing, cfg }: { listing: ReserveListing; cfg: ClientCfg }) {
  const router = useRouter();
  const { when, guests, setGuests, quote, quoting, error } = useB();
  const [open, setOpen] = useState<null | "dates" | "who">(null);
  const [sheet, setSheet] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const win = windowFor(listing.unit, when, listing.details);
  const ready = !!win && !!quote && quote.bookable !== false && !error;
  const max = Number(listing.details?.sleeps || 0) || undefined;
  const pets = listing.details?.pets !== false;
  const action = cfg.copy.reserve;

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function go() {
    if (!ready) { setOpen("dates"); setSheet(true); return; }
    router.push(`/reserve/${listing.id}?${whenQuery(when, listing.unit === "night" ? guests : undefined)}`);
  }
  const startText = listing.unit === "hour" ? (when.date ? rangeLabel(when.date) : null) : when.from ? dayLabel(`${when.from}T12:00:00Z`, { month: "numeric", day: "numeric", year: "numeric" }) : null;
  const endText = listing.unit === "hour" ? (when.date && when.start != null ? `${clockLabel(when.start)} · ${when.hours}h` : null) : when.to ? dayLabel(`${when.to}T12:00:00Z`, { month: "numeric", day: "numeric", year: "numeric" }) : null;
  const label = (k: "start" | "end") => listing.unit === "hour" ? (k === "start" ? "Date" : "Time") : k === "start" ? cfg.search.start : cfg.search.end;

  const priceHead = (
    <div className="mk-reserve-price">
      <div className="p">
        {ready && quote ? <>{money(quote.total, quote.currency)} <span>total</span></> : listing.price != null ? <>{money(listing.price)} <span>{listing.unit}</span></> : <span>Add dates for prices</span>}
      </div>
      {listing.rating.count > 0 && <span className="mk-star" style={{ fontSize: 14 }}>{I.star}{stars(listing.rating.average)} <span className="mk-muted" style={{ fontWeight: 400 }}>· {listing.rating.count} review{listing.rating.count === 1 ? "" : "s"}</span></span>}
    </div>
  );

  const picker = (
    <div className="mk-pick">
      <div className="mk-pick-dates" style={!cfg.guests ? { borderBottom: 0 } : undefined}>
        <button type="button" className="mk-pick-cell" onClick={() => setOpen(open === "dates" ? null : "dates")}><b>{label("start")}</b><span className={startText ? "" : "ph"}>{startText || "Add date"}</span></button>
        <button type="button" className="mk-pick-cell" onClick={() => setOpen(open === "dates" ? null : "dates")}><b>{label("end")}</b><span className={endText ? "" : "ph"}>{endText || "Add date"}</span></button>
      </div>
      {cfg.guests && (
        <button type="button" className="mk-pick-cell mk-pick-who" onClick={() => setOpen(open === "who" ? null : "who")}>
          <span><b>Guests</b><span>{guestsLabel(guests, "1 guest")}</span></span>{I.down}
        </button>
      )}
      {open === "dates" && <div className="mk-pick-pop cal"><WhenPicker listing={listing} cfg={cfg} onDone={() => setOpen(cfg.guests ? null : null)} /></div>}
      {open === "who" && cfg.guests && (
        <div className="mk-pick-pop">
          <GuestCounters value={guests} onChange={setGuests} max={max} pets={pets} />
          <div className="close"><button type="button" className="mk-link" onClick={() => setOpen(null)}>Close</button></div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <aside className="mk-lp-side">
        <div className="mk-reserve" ref={ref}>
          {priceHead}
          {picker}
          <button type="button" className="mk-btn warm lg block" onClick={go} disabled={quoting}>{ready ? action : "Check availability"}</button>
          {error && <p className="mk-err" style={{ marginTop: 12 }}>{error}</p>}
          {ready && <p className="mk-reserve-note">{cfg.copy.instantNote}</p>}
          {quoting && !quote && <p className="mk-reserve-q">Checking the price…</p>}
          {ready && quote && <QuoteLines q={quote} price={listing.price} unit={listing.unit} />}
        </div>
      </aside>

      <div className="mk-mbar">
        <div>
          {ready && quote ? <b>{money(quote.total, quote.currency)} total</b> : listing.price != null ? <b>{money(listing.price)} <span style={{ fontWeight: 400 }}>{listing.unit}</span></b> : null}
          <small onClick={() => setSheet(true)} role="button">{ready ? (listing.unit === "hour" ? `${startText} · ${endText}` : rangeLabel(when.from!, when.to!)) : "Add dates"}</small>
        </div>
        <button type="button" className="mk-btn warm" onClick={ready ? go : () => setSheet(true)}>{ready ? action : "Check availability"}</button>
      </div>

      {sheet && (
        <div className="mk mk-msheet" role="dialog" aria-modal="true" aria-label="Dates">
          <div className="mk-msheet-h"><button type="button" aria-label="Close" onClick={() => setSheet(false)}>✕</button><span /></div>
          <div className="mk-msheet-b">
            <div className="mk-mcard">
              <h3>{listing.unit === "night" ? (when.from && when.to ? `${nightsBetween(when.from, when.to)} nights in ${listing.city}` : "Select dates") : "When do you need it?"}</h3>
              <WhenPicker listing={listing} cfg={cfg} months={1} />
            </div>
            {cfg.guests && <div className="mk-mcard"><h3>Guests</h3><GuestCounters value={guests} onChange={setGuests} max={max} pets={pets} /></div>}
            {error && <p className="mk-err">{error}</p>}
            {ready && quote && <div className="mk-mcard"><h3 style={{ fontSize: 18 }}>Price details</h3><QuoteLines q={quote} price={listing.price} unit={listing.unit} /></div>}
          </div>
          <div className="mk-msheet-f">
            <span>{ready && quote ? <b>{money(quote.total, quote.currency)}</b> : quoting ? "Checking…" : ""}</span>
            <button type="button" className="mk-btn warm lg" disabled={!ready} onClick={go}>{action}</button>
          </div>
        </div>
      )}
    </>
  );
}

/** The in-page availability calendar, in step with the reserve card. */
export function AvailabilitySection({ listing, cfg }: { listing: ReserveListing; cfg: ClientCfg }) {
  const { when } = useB();
  const n = nightsBetween(when.from || undefined, when.to || undefined);
  const title = listing.unit === "hour"
    ? (when.date ? `${rangeLabel(when.date)} at ${listing.city}` : "Pick a date")
    : n > 0 ? `${n} ${listing.unit === "night" ? (n === 1 ? "night" : "nights") : n === 1 ? "day" : "days"} in ${listing.city}` : `Select ${cfg.search.start.toLowerCase()} date`;
  const sub = listing.unit === "hour" ? "Choose a start time and how long you need it" : when.from && when.to ? rangeLabel(when.from, when.to) : listing.minimum > 1 ? `Minimum stay: ${listing.minimum} ${listing.unit === "night" ? "nights" : "days"}` : "Add your dates for exact pricing";
  return (
    <section>
      <h2 style={{ marginBottom: 4 }}>{title}</h2>
      <p className="mk-muted" style={{ marginBottom: 20 }}>{sub}</p>
      <WhenPicker listing={listing} cfg={cfg} />
    </section>
  );
}
