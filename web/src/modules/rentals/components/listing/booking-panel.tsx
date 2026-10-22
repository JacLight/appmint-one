"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createBookingAction } from "@/modules/rentals/actions/booking";
import { useRouter } from "next/navigation";
import { quoteAction, availabilityAction, addToCartAction } from "@/modules/rentals/actions/checkout";
import type { BookingItemInput, CheckoutQuote, ConditionalFee } from "@/api/rentals";
import { routes } from "@/lib/nav";
import { PaymentStep } from "./payment-step";

export type PanelPayment = { upfront?: number; deposit?: number; depositRefundable?: boolean };
export type PanelAddOn = { name: string; title?: string; price?: number; chargeEvery?: string };
export type PanelSpot = { sk: string; title: string; price?: number; priceUnit?: string; capacity: number };
/** The listing's own access schedule — the times the picker is allowed to offer.
 *  windows govern the handoff (start AND end must fall in one); slotMinutes is the grid. */
export type PanelAvailability = {
  windows?: { days?: string[]; opens?: string; closes?: string; label?: string }[];
  slotMinutes?: number;
  bufferMinutes?: number;
  from?: string;
  to?: string;
};
// `available` is what the server says is free FOR the chosen dates (null = not queried yet).
type Line = { spot: string; qty: number; from: string; to: string; addOns: Set<string>; available: number | null; availLoading: boolean; fitReason?: string };

const TIME_BASED = new Set(["hour", "day", "week", "month"]);
// Show cents only when there are cents ($8, but $16.60) — never round a charge.
const money = (n: number, cur = "USD") => {
  const hasCents = Math.round(n * 100) % 100 !== 0;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: cur, minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 }).format(n);
};
const fmtDay = (v?: string) => { if (!v) return ""; const d = new Date(v.includes("T") ? v : `${v}T12:00`); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); };
const fmtRange = (a?: string, b?: string) => { const s = fmtDay(a), e = fmtDay(b); return s && e ? `${s} → ${e}` : (s || e || ""); };
const datePart = (v: string) => v.split("T")[0] || "";
const timePart = (v: string) => v.split("T")[1]?.slice(0, 5) || "";
const joinDT = (d: string, t: string) => (d ? (t ? `${d}T${t}` : `${d}T12:00`) : "");
function plural(n: string): string {
  if (/(s|x|z|ch|sh)$/i.test(n)) return `${n}es`;
  if (/[^aeiou]y$/i.test(n)) return `${n.slice(0, -1)}ies`;
  return `${n}s`;
}
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── Listing-driven time slots ──────────────────────────────────────────────
// The picker only ever offers times the LISTING declares (its access windows +
// slotMinutes grid). No windows = any time. Never a free-typed 11:31.
const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const toMin = (hm: string) => { const [h, m] = (hm || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
function weekdayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return DOW[new Date(y, (m || 1) - 1, d || 1).getDay()];
}
function label12(hm: string): string {
  const [h, m] = hm.split(":").map(Number);
  const ap = h < 12 ? "AM" : "PM", h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}
/** The bookable start/end times for a given date, from the listing's own schedule. */
function slotsForDate(av: PanelAvailability | undefined, dateStr: string, fallbackStep: number): { v: string; label: string }[] {
  if (!dateStr) return [];
  const step = av?.slotMinutes && av.slotMinutes > 0 && av.slotMinutes < 1440 ? av.slotMinutes : fallbackStep;
  const dow = weekdayOf(dateStr);
  const wins = (av?.windows ?? []).filter((w) => !w.days?.length || w.days.map((x) => x.toLowerCase()).includes(dow));
  // No matching windows → this listing takes handoffs any time that day.
  const ranges: [number, number][] = wins.length
    ? wins.map((w) => [toMin(w.opens || "00:00"), toMin(w.closes || "23:59")])
    : [[0, 24 * 60 - step]];
  const out: { v: string; label: string }[] = [], seen = new Set<string>();
  for (const [a, b] of ranges) for (let m = a; m <= b && m < 24 * 60; m += step) {
    const hm = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    if (!seen.has(hm)) { seen.add(hm); out.push({ v: hm, label: label12(hm) }); }
  }
  return out.sort((x, y) => x.v.localeCompare(y.v));
}
/** A one-line, human summary of the listing's access schedule, shown in the panel. */
function hoursSummary(av: PanelAvailability | undefined): string | null {
  const wins = av?.windows ?? [];
  if (!wins.length) return null; // any time — no need to state it
  const dayLabel = (ds?: string[]) => {
    if (!ds?.length || ds.length === 7) return "Every day";
    const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const idx = ds.map((d) => order.indexOf(d.toLowerCase())).sort((a, b) => a - b);
    const contiguous = idx.every((n, i) => i === 0 || n === idx[i - 1] + 1);
    return contiguous && idx.length > 1
      ? `${cap(order[idx[0]])}–${cap(order[idx[idx.length - 1]])}`
      : idx.map((n) => cap(order[n])).join(", ");
  };
  return wins.map((w) => `${dayLabel(w.days)} ${label12(w.opens || "00:00")}–${label12(w.closes || "23:59")}`).join(" · ");
}
/** Round a Date up to the next `step`-minute boundary. */
function snapUp(d: Date, step: number): Date {
  const out = new Date(d); out.setSeconds(0, 0);
  const rem = out.getMinutes() % step;
  if (rem) out.setMinutes(out.getMinutes() + (step - rem));
  return out;
}

/** Sensible default dates so the panel is usable immediately (Uber/Airbnb-style):
 *  today → +1 period for storage; next slot → +2h for timed spaces. */
function defaultDates(timeOfDay: boolean, unit?: string, step = 30): { from: string; to: string } {
  const p = (n: number) => String(n).padStart(2, "0");
  const ymd = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const now = new Date();
  if (timeOfDay) {
    const start = snapUp(now, step);
    const end = new Date(start.getTime() + 2 * 3600 * 1000);
    const hm = (d: Date) => `${p(d.getHours())}:${p(d.getMinutes())}`;
    return { from: `${ymd(start)}T${hm(start)}`, to: `${ymd(end)}T${hm(end)}` };
  }
  const end = new Date(now);
  if (unit === "day") end.setDate(end.getDate() + 1);
  else if (unit === "week") end.setDate(end.getDate() + 7);
  else end.setMonth(end.getMonth() + 1);
  return { from: ymd(now), to: ymd(end) };
}

/** Fixed-slot time dropdown — the only values are the listing's own slots. */
function TimeSelect({ value, opts, onChange }: { value: string; opts: { v: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <select className="bp-timesel" value={value} onChange={(e) => onChange(e.target.value)}>
      {!value && <option value="" disabled>Select a time</option>}
      {opts.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      {value && !opts.some((o) => o.v === value) && <option value={value}>{label12(value)}</option>}
    </select>
  );
}

/** Render the server's canonical cart totals — never derive a number here.
 *  The band breakdown (`rateLines`) is per line; `subtotal/serviceFee/protectionFee/tax`
 *  are canonical cart totals; taxLines carry jurisdiction. `total` is the truth. */
function QuoteBreakdown({ q }: { q: CheckoutQuote }) {
  const lines = q.lines ?? [];
  const multi = lines.length > 1;
  // Per-line rate bands, exactly as the server priced them (never rate × duration).
  const bandRows = lines.flatMap((ln, li) => {
    const rl = ln.rateLines ?? [];
    if (!rl.length) return [];
    return [
      ...(multi && (ln.listingTitle) ? [{ head: ln.listingTitle, key: `h${li}` }] : []),
      ...rl.map((r, ri) => ({ label: r.label || "Rate", amount: r.amount, key: `${li}-${ri}` })),
    ];
  });
  const fees: { label: string; amount: number; neg?: boolean }[] = [];
  (q.discounts ?? []).forEach((d) => fees.push({ label: d.name || d.label || (d.code ? `Discount (${d.code})` : "Discount"), amount: d.amount, neg: true }));
  // Every fee is a ROW the server priced (booking fee, trust, a host's cleaning fee…).
  // Legacy serviceFee/protectionFee only when the server sent no rows.
  const feeRows = q.fees?.length ? q.fees : (q.lines ?? []).flatMap((l) => l.fees ?? []);
  if (feeRows.length) feeRows.forEach((f) => fees.push({ label: f.label, amount: f.amount }));
  else {
    if (q.serviceFee) fees.push({ label: "Service fee", amount: q.serviceFee });
    if (q.protectionFee) fees.push({ label: "Protection", amount: q.protectionFee });
  }
  const hasFeeRows = fees.length > 0;
  if (q.taxLines?.length) q.taxLines.forEach((t) => fees.push({ label: t.jurisdiction ? `Tax · ${t.jurisdiction}` : "Tax", amount: t.amount }));
  else if (q.tax) fees.push({ label: "Tax", amount: q.tax });
  return (
    <>
      {bandRows.length > 0
        ? bandRows.map((r: any) => (
            "head" in r
              ? <div key={r.key} className="bp-qrow bp-qrow-head"><span>{r.head}</span><span /></div>
              : <div key={r.key} className="bp-qrow"><span>{r.label}</span><span>{money(r.amount, q.currency)}</span></div>
          ))
        : <div className="bp-qrow"><span>Subtotal</span><span>{money(q.subtotal, q.currency)}</span></div>}
      {bandRows.length > 0 && q.subtotal != null && (hasFeeRows || q.tax || q.taxLines?.length)
        ? <div className="bp-qrow bp-qrow-sub"><span>Subtotal</span><span>{money(q.subtotal, q.currency)}</span></div> : null}
      {fees.map((r, i) => (
        <div key={`f${i}`} className="bp-qrow"><span>{r.label}</span><span>{r.neg ? "−" : ""}{money(Math.abs(r.amount), q.currency)}</span></div>
      ))}
      {q.discountRejected && <div className="bp-qrow bp-qrow-note"><span>{q.discountRejected.message || "Discount code not applied"}</span><span /></div>}
      <div className="bp-total"><span>Total</span><b>{money(q.total, q.currency)}</b></div>
      <GoodToKnow fees={goodToKnow(q)} currency={q.currency} />
    </>
  );
}

const TRIGGER_LABEL: Record<string, string> = { cancellation: "If you cancel", no_show: "If you don’t show", late_pickup: "Late pick-up" };
/** Fees that only apply in another state — dedup'd across lines. */
export function goodToKnow(q: CheckoutQuote): ConditionalFee[] {
  const all = [...(q.conditionalFees ?? []), ...(q.lines ?? []).flatMap((l) => l.conditionalFees ?? [])];
  const seen = new Set<string>();
  return all.filter((f) => { const k = `${f.trigger}|${f.code || f.label}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
/** "Good to know" — the fees that would apply on cancel / no-show / late pick-up, with the
 *  server's rule text and estimate. Nothing here is on the bill unless that happens. */
export function GoodToKnow({ fees, currency = "USD" }: { fees: ConditionalFee[]; currency?: string }) {
  if (!fees.length) return null;
  return (
    <div className="bp-gtk">
      <b>Good to know</b>
      {fees.map((f, i) => (
        <div className="bp-gtk-row" key={i}>
          <span>{TRIGGER_LABEL[f.trigger] || f.trigger}: {f.label}{f.rule ? ` — ${f.rule}` : ""}</span>
          {f.estimate != null ? <span>{money(f.estimate, currency)}</span> : null}
        </div>
      ))}
    </div>
  );
}

/** How and when money moves — the listing's payment policy, in the customer's words.
 *  `upfront` 100 = pay now (the norm, shown quietly); 0 = pay on the way out; 50 = split.
 *  A deposit is a refundable hold that stands apart from the bill. */
function PaymentTerms({ payment, total }: { payment?: PanelPayment; total?: number }) {
  const up = payment?.upfront ?? 100;
  const dep = payment?.deposit ?? 0;
  if (total === 0 && dep <= 0) return null;   // free, no hold — nothing to explain
  if (up >= 100 && dep <= 0) return null;      // pay-in-advance, no hold — nothing to explain
  const when = up === 0 ? "You pay on the way out — nothing charged now."
    : up < 100 ? `${up}% is due now, the rest at check-out.`
    : null;
  const hold = dep > 0
    ? (payment?.depositRefundable === false
        ? `A ${money(dep)} deposit is taken and credited to your final bill.`
        : `A ${money(dep)} refundable hold is placed — returned after, not part of the total.`)
    : null;
  return (
    <div className="bp-terms">
      {when && <div><span className="bp-terms-ic">◔</span>{when}</div>}
      {hold && <div><span className="bp-terms-ic">🛡</span>{hold}</div>}
    </div>
  );
}

export function BookingPanel({
  listingId, price, priceUnit, capacity, unitNoun = "unit", addOns, spots = [], signedIn, timeOfDay = false,
  availability, payment, initialFrom = "", initialTo = "", title = "This space", locationLabel, staffingLabel,
}: {
  listingId: string; price?: number; priceUnit?: string; capacity: number; unitNoun?: string;
  addOns: PanelAddOn[]; spots?: PanelSpot[]; signedIn: boolean; timeOfDay?: boolean;
  availability?: PanelAvailability; payment?: PanelPayment;
  initialFrom?: string; initialTo?: string;
  title?: string; locationLabel?: string; staffingLabel?: string;
}) {
  const slotStep = availability?.slotMinutes && availability.slotMinutes > 0 && availability.slotMinutes < 1440
    ? availability.slotMinutes
    : (priceUnit === "hour" || spots[0]?.priceUnit === "hour" ? 60 : 30);
  const hasSpots = spots.length > 0;
  const newLine = (): Line => ({ spot: hasSpots ? spots[0].sk : "", qty: 1, from: "", to: "", addOns: new Set(), available: null, availLoading: false });
  // Dates come from the search when present.
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([{ ...newLine(), from: initialFrom, to: initialTo }]);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false); // "added to cart" flash

  // Promo code — the server validates and prices it; we only carry the string.
  const [code, setCode] = useState("");
  const [codeOpen, setCodeOpen] = useState(false);
  // server pricing
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteState, setQuoteState] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");

  const resolve = (l: Line) => {
    const s = hasSpots ? spots.find((x) => x.sk === l.spot) ?? spots[0] : null;
    return {
      listing: s ? s.sk : listingId, price: s ? s.price : price, priceUnit: s ? s.priceUnit : priceUnit,
      capacity: s ? s.capacity : capacity, label: s ? s.title : unitNoun,
    };
  };
  // Where "Back to listing" from checkout returns to: this exact listing view,
  // preserving the ?ref=<filtered browse> + dates in the URL.
  const returnHref = () => (typeof window !== "undefined" ? window.location.pathname + window.location.search : routes.listing(listingId));
  const set = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, newLine()]);
  const removeLine = (i: number) => setLines((ls) => (ls.length === 1 ? ls : ls.filter((_, j) => j !== i)));
  const toggleAddOn = (i: number, name: string) => setLines((ls) => ls.map((l, j) => {
    if (j !== i) return l;
    const n = new Set(l.addOns); n.has(name) ? n.delete(name) : n.add(name); return { ...l, addOns: n };
  }));

  const datesSet = (l: Line) => !!l.from && !!l.to && Date.parse(l.to) > Date.parse(l.from);
  const validLine = (l: Line) => datesSet(l) && l.qty >= 1 && (l.available == null || l.qty <= l.available) && (l.available == null || l.available > 0);
  const allValid = lines.length > 0 && lines.every(validLine);
  const buildItems = (): BookingItemInput[] => lines.map((l) => {
    const r = resolve(l);
    return { listing: r.listing, startDate: l.from, endDate: l.to, quantity: l.qty, addOns: [...l.addOns].map((name) => ({ name })) };
  });

  // Default the dates on first mount (search dates already win via initial state).
  // Storage → today → +1 period (Airbnb-style); event/car/bag → now (Uber-style).
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    setLines((ls) => ls.map((l, i) => (i === 0 && !l.from && !l.to ? { ...l, ...defaultDates(timeOfDay, priceUnit || spots[0]?.priceUnit, slotStep) } : l)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // DATES DRIVE EVERYTHING: whenever a line's spot or dates change, ask the server
  // how many are free for THAT window, then bound quantity by it.
  useEffect(() => {
    lines.forEach((l, i) => {
      if (!datesSet(l)) return;
      if (l.available != null || l.availLoading) return; // already resolved/loading for these dates
      const r = resolve(l);
      setLines((ls) => ls.map((x, j) => (j === i ? { ...x, availLoading: true } : x)));
      availabilityAction(r.listing, l.from, l.to).then((res) => {
        setLines((ls) => ls.map((x, j) => {
          if (j !== i) return x;
          // On an availability error, DON'T fall back to full capacity — that
          // invites an over-book that only fails later at checkout. Show 0 and a
          // reason; the server is the real gate anyway.
          const n = res.ok ? res.available : 0;
          return { ...x, available: n, availLoading: false, fitReason: res.ok ? res.fitReason : "Couldn't check availability — try again", qty: Math.max(1, Math.min(x.qty, Math.max(1, n))) };
        }));
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(lines.map((l) => ({ spot: l.spot, from: l.from, to: l.to, available: l.available })))]);

  // Live server quote whenever the selection changes. Never compute here.
  const reqId = useRef(0);
  useEffect(() => {
    if (!allValid) { setQuote(null); setQuoteState("idle"); return; }
    const items = buildItems();
    const id = ++reqId.current;
    setQuoteState("loading");
    const t = setTimeout(async () => {
      const res = await quoteAction(items, code);
      if (id !== reqId.current) return;
      if (res.ok) { setQuote(res.quote); setQuoteState("ready"); }
      else { setQuote(null); setQuoteState("unavailable"); }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(lines.map((l) => ({ spot: l.spot, qty: l.qty, from: l.from, to: l.to, addOns: [...l.addOns] }))), code]);

  /** Reserve → add to the cart, then straight to /checkout to pay. The cart lives
   *  on the server, so /checkout shows everything and survives back/forward. */
  function placeHold() {
    setError(null);
    const items = buildItems();
    start(async () => {
      const res = await addToCartAction(items, returnHref(), code);
      if (res.ok) { router.push("/checkout"); return; }
      if (res.notFound) {
        // checkout/cart endpoints not deployed here → book directly, land on bookings
        const b = await createBookingAction(items, "USD");
        if (b.ok) router.push(routes.account + "/bookings");
        else setError(b.error ?? "Could not complete booking.");
        return;
      }
      setError(res.error ?? "Could not start checkout.");
    });
  }

  /** Add to cart — accumulate this listing in the open cart, keep shopping. */
  function addToCart() {
    setError(null);
    const items = buildItems();
    start(async () => {
      const res = await addToCartAction(items, returnHref(), code);
      if (res.ok) { setAdded(true); try { window.dispatchEvent(new Event("stowbo-cart-changed")); } catch { /* ssr */ } setTimeout(() => setAdded(false), 3200); return; }
      setError(res.error ?? "Could not add to cart.");
    });
  }


  // ── CART step ──
  const fromPrice = hasSpots ? Math.min(...spots.map((s) => s.price ?? Infinity).filter((n) => Number.isFinite(n))) : price;
  const fromUnit = hasSpots ? spots[0].priceUnit : priceUnit;

  return (
    <div className="book">
      <div className="p">from&nbsp;<b>{fromPrice != null && Number.isFinite(fromPrice) ? `$${fromPrice}` : "—"}</b><small>/ {fromUnit || "day"}</small></div>
      <div className="bp-cap">
        {hasSpots ? <>Pick a spot type and your dates, then choose how many — all on the same dates. Need different dates for some? Add a range below.</>
          : <>Set your dates once, then choose <b>how many</b> — up to <b>{capacity}</b> {capacity === 1 ? unitNoun : plural(unitNoun)}, all on the same dates. Booking some for different dates? Add a separate range below.</>}
      </div>

      <div className="bp-lines">
        {lines.map((l, i) => {
          const r = resolve(l);
          return (
            <div key={i} className="bp-line">
              {/* Header only distinguishes multiple date-ranges (or spot types); a single
                  same-dates booking needs no "Unit 1" label — the quantity does that job. */}
              {(hasSpots || lines.length > 1) && (
                <div className="bp-line-head">
                  <span className="bp-line-title">{hasSpots ? r.label : `Date range ${i + 1}`}</span>
                  {lines.length > 1 && (
                    <button type="button" className="bp-x" onClick={() => removeLine(i)} aria-label="Remove">
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  )}
                </div>
              )}

              {hasSpots && (
                <label className="bp-spot">What are you storing?
                  <select value={l.spot} onChange={(e) => set(i, { spot: e.target.value, qty: 1, available: null })}>
                    {spots.map((s) => <option key={s.sk} value={s.sk}>{s.title}{s.price != null ? ` — from $${s.price}/${s.priceUnit || "mo"}` : ""}</option>)}
                  </select>
                </label>
              )}

              {/* 1. DATES first — everything downstream is scoped to them */}
              {timeOfDay ? (
                <>
                  {hoursSummary(availability) && (
                    <div className="bp-hours">Open {hoursSummary(availability)}{slotStep >= 60 ? " · hourly slots" : slotStep === 30 ? " · half-hour slots" : ` · ${slotStep}-min slots`}</div>
                  )}
                  <div className="bp-dt">
                    <label className="bp-date bp-dt-d">Drop-off<input type="date" value={datePart(l.from)} onChange={(e) => set(i, { from: joinDT(e.target.value, timePart(l.from)), available: null })} /></label>
                    <label className="bp-date bp-dt-t">Time
                      <TimeSelect value={timePart(l.from)} opts={slotsForDate(availability, datePart(l.from), slotStep)} onChange={(t) => set(i, { from: joinDT(datePart(l.from), t), available: null })} />
                    </label>
                  </div>
                  <div className="bp-dt">
                    <label className="bp-date bp-dt-d">Pick-up<input type="date" min={datePart(l.from) || undefined} value={datePart(l.to)} onChange={(e) => set(i, { to: joinDT(e.target.value, timePart(l.to)), available: null })} /></label>
                    <label className="bp-date bp-dt-t">Time
                      <TimeSelect value={timePart(l.to)} opts={slotsForDate(availability, datePart(l.to), slotStep)} onChange={(t) => set(i, { to: joinDT(datePart(l.to), t), available: null })} />
                    </label>
                  </div>
                </>
              ) : (
                <div className="bp-dates">
                  <label className="bp-date">Drop-off<input type="date" value={l.from} max={l.to || undefined} onChange={(e) => set(i, { from: e.target.value, available: null })} /></label>
                  <label className="bp-date">Pick-up<input type="date" value={l.to} min={l.from || undefined} onChange={(e) => set(i, { to: e.target.value, available: null })} /></label>
                </div>
              )}

              {/* 2. QUANTITY — only after dates, bounded by what's free for those dates */}
              {datesSet(l) && (
                l.availLoading ? (
                  <div className="bp-avail-msg">Checking availability…</div>
                ) : l.available === 0 ? (
                  <div className="bp-avail-msg bp-avail-none">{l.fitReason || "None available for these dates — try other dates."}</div>
                ) : (
                  <div className="bp-qtyrow">
                    <div className="bp-qty-hd">
                      <span className="bp-qty-lbl">How many {plural(hasSpots ? "unit" : unitNoun)}?</span>
                      {l.available != null && <span className="bp-qty-avail"><b>{l.available}</b> available for these dates</span>}
                    </div>
                    <div className="bp-stepper">
                      <button type="button" onClick={() => set(i, { qty: Math.max(1, l.qty - 1) })} aria-label="Decrease" disabled={l.qty <= 1}>−</button>
                      <input type="number" inputMode="numeric" min={1} max={l.available ?? r.capacity} value={l.qty}
                        onChange={(e) => { const n = parseInt(e.target.value, 10); const mx = l.available ?? r.capacity; set(i, { qty: Number.isNaN(n) ? 1 : Math.max(1, Math.min(mx, n)) }); }}
                        aria-label="Quantity" />
                      <button type="button" onClick={() => set(i, { qty: Math.min(l.available ?? r.capacity, l.qty + 1) })} aria-label="Increase" disabled={l.qty >= (l.available ?? r.capacity)}>+</button>
                    </div>
                  </div>
                )
              )}

              {addOns.length > 0 && datesSet(l) && l.available !== 0 && (
                <div className="bp-addons">
                  {addOns.map((a) => (
                    <button type="button" key={a.name} className={`bp-addon${l.addOns.has(a.name) ? " on" : ""}`} onClick={() => toggleAddOn(i, a.name)}>
                      <span>{a.title || a.name}</span>
                      <b>{a.price ? `+$${a.price}${TIME_BASED.has(a.chargeEvery ?? "") ? `/${a.chargeEvery}` : ""}` : "Free"}</b>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Escape hatch for the uncommon case: some units on DIFFERENT dates. */}
      <button type="button" className="bp-add" onClick={addLine}>+ Add {hasSpots ? "a spot" : "units"} on different dates</button>

      {allValid && (
        <div className="bp-quote">
          {quoteState === "loading" && <div className="bp-quote-msg">Getting your price…</div>}
          {quoteState === "ready" && quote && <QuoteBreakdown q={quote} />}
          {quoteState === "unavailable" && <div className="bp-quote-msg">Your total is confirmed at checkout.</div>}
          {codeOpen || code ? (
            <div className="bp-code">
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Promo code" aria-label="Promo code" autoCapitalize="characters" spellCheck={false} />
              {code && <button type="button" className="bp-code-x" onClick={() => { setCode(""); setCodeOpen(false); }} aria-label="Remove code">×</button>}
            </div>
          ) : (
            <button type="button" className="bp-code-link" onClick={() => setCodeOpen(true)}>Have a promo code?</button>
          )}
        </div>
      )}

      <PaymentTerms payment={payment} total={quote?.total} />

      {error && <div className="bp-error">{error}</div>}

      {signedIn ? (
        <>
          <button type="button" className="btn clay lg" style={{ width: "100%", justifyContent: "center", marginTop: 4 }} onClick={placeHold} disabled={!allValid || pending}>
            {pending ? "Reserving…" : "Reserve"}
          </button>
          {added ? (
            <button type="button" className="btn ghost" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={() => { try { window.dispatchEvent(new Event("stowbo-cart-open")); } catch { /* ssr */ } }}>
              Added ✓ — View cart →
            </button>
          ) : (
            <button type="button" className="btn ghost" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={addToCart} disabled={!allValid || pending}>
              Add to cart
            </button>
          )}
        </>
      ) : (
        <Link className="btn clay lg" href={`${routes.login}?next=${encodeURIComponent(routes.listing(listingId))}`} style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>Sign in to book</Link>
      )}
      <p className="note" style={{ textAlign: "center", marginTop: 10 }}>Every booking is verified &amp; Stowbo-protected up to $5,000.</p>
    </div>
  );
}
