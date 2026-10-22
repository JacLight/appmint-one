"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { routes } from "@/lib/nav";
import { PaymentStep } from "@/modules/rentals/components/listing/payment-step";
import { confirmAction, releaseHoldKeepCartAction, applyCartCodeAction, type Confirmed } from "@/modules/rentals/actions/checkout";
import type { CheckoutQuote } from "@/api/rentals";
import { GoodToKnow, goodToKnow } from "@/modules/rentals/components/listing/booking-panel";

export type CheckoutLine = { title: string; sub?: string; startDate?: string; endDate?: string; quantity?: number; amount?: number };
export type CheckoutData = {
  checkoutId: string;
  quote?: CheckoutQuote | null;
  holdExpiresAt?: string | null;
  lines: CheckoutLine[];
  // What the server charges now (upfront% + deposit); falls back to the total.
  dueNow?: number; dueUpfront?: number; dueDeposit?: number; currency?: string;
  // The listing they came from, so "Back to listing" goes exactly there.
  returnTo?: string | null;
};

// Show cents only when there are cents ($8, but $16.60) — rounding to whole
// dollars made the confirmation say $17 for a $16.60 charge.
const money = (n: number, cur = "USD") => {
  const hasCents = Math.round(n * 100) % 100 !== 0;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: cur, minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 }).format(n);
};
const parse = (v?: string) => { if (!v) return null; const d = new Date(v.includes("T") ? v : `${v}T12:00`); return Number.isNaN(d.getTime()) ? null : d; };
const hasTime = (v?: string) => !!v && v.includes("T") && !/T12:00(:00)?$/.test(v);
/** "Wed, Aug 27" — plus "· 2:30 PM" when the listing books by time of day. */
const fmtFull = (v?: string) => {
  const d = parse(v); if (!d) return "—";
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return hasTime(v) ? `${day} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : day;
};
/** Human span between drop-off and pick-up: "31 days", "3 hours". */
const duration = (a?: string, b?: string) => {
  const s = parse(a), e = parse(b); if (!s || !e) return "";
  const ms = e.getTime() - s.getTime(); if (ms <= 0) return "";
  const mins = Math.round(ms / 60000), hrs = Math.round(ms / 3.6e6), days = Math.round(ms / 8.64e7), wks = Math.round(days / 7), mos = Math.round(days / 30);
  if (mins < 60) return `${mins} min`;
  if (hrs < 24) return `${hrs} ${hrs === 1 ? "hour" : "hours"}`;
  if (days < 14) return `${days} ${days === 1 ? "day" : "days"}`;
  if (days < 60) return `${wks} ${wks === 1 ? "week" : "weeks"}`;
  return `${mos} ${mos === 1 ? "month" : "months"}`;
};

type RowLine = { title: string; sub?: string; startDate?: string; endDate?: string; quantity?: number; amount?: number };
/** One booking, spelled out: what, how many, how long, and the exact drop-off /
 *  pick-up — never a bare "date → date". */
function ItemRow({ l, cur }: { l: RowLine; cur: string }) {
  const dur = duration(l.startDate, l.endDate);
  return (
    <div className="co-item">
      <div className="co-item-top">
        <span className="co-item-title">{l.title}{l.sub ? <span className="co-item-sub"> · {l.sub}</span> : null}</span>
        {l.amount ? <span className="co-item-amt">{money(l.amount, cur)}</span> : null}
      </div>
      {(l.quantity && l.quantity > 1) || dur ? (
        <div className="co-item-meta">
          {l.quantity && l.quantity > 1 ? <span className="co-chip">{l.quantity} units</span> : null}
          {dur ? <span className="co-chip">{dur}</span> : null}
        </div>
      ) : null}
      <div className="co-item-dates">
        <div className="co-dt"><span>Drop-off</span><b>{fmtFull(l.startDate)}</b></div>
        <span className="co-dt-sep" aria-hidden>→</span>
        <div className="co-dt"><span>Pick-up</span><b>{fmtFull(l.endDate)}</b></div>
      </div>
    </div>
  );
}

export function CheckoutClient({ data, onReload }: { data: CheckoutData; onReload?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Confirmed | null>(null);
  const [left, setLeft] = useState<number>(0);
  const [leaveTo, setLeaveTo] = useState<string | null>(null); // pending "leave checkout?" target
  const [code, setCode] = useState("");
  const [codeOpen, setCodeOpen] = useState(false);
  const applied = data.quote?.discounts?.[0];
  const rejected = data.quote?.discountRejected;
  // Changing the code means re-pricing, and the server won't re-price HELD lines: the
  // action releases the hold and saves the cart with the code; the loader then takes a
  // fresh hold at the new price. (Not a page reload — the leave-guard below would block it.)
  function applyCode(next: string) {
    setError(null);
    start(async () => {
      const r = await applyCartCodeAction(next);
      if (!r.ok) { setError(r.error ?? "Could not apply that code."); return; }
      if (onReload) onReload(); else window.location.reload();
    });
  }

  const cur = data.currency ?? data.quote?.currency ?? "USD";
  const total = data.quote?.total ?? data.lines.reduce((s, l) => s + (l.amount ?? 0), 0);
  const payNow = data.dueNow != null ? data.dueNow : total;
  const laterDue = data.dueUpfront != null ? Math.round(Math.max(0, total - data.dueUpfront) * 100) / 100 : 0;
  const deposit = data.dueDeposit ?? 0;

  // Hold countdown.
  useEffect(() => {
    if (!data.holdExpiresAt) return;
    const tick = () => setLeft(Math.max(0, Math.round((Date.parse(data.holdExpiresAt!) - Date.now()) / 1000)));
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv);
  }, [data.holdExpiresAt]);

  const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, "0");
  const expired = !!data.holdExpiresAt && left <= 0;
  // A live, unconfirmed hold is at stake while they're on this page.
  const holdAtStake = !!data.holdExpiresAt && !expired && !done;

  // Leaving with a live hold shouldn't silently drop it. Intercept navigation
  // away (in-app link clicks + tab close) and make the choice explicit: keep the
  // hold and stay, or leave and release it (the cart is kept either way).
  useEffect(() => {
    if (!holdAtStake) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (!href || href.startsWith("#") || a.target === "_blank" || href.startsWith("http") || href.startsWith("mailto:")) return;
      if (href.startsWith("/checkout")) return; // staying on checkout
      e.preventDefault();
      setLeaveTo(href);
    };
    const onBefore = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBefore);
    return () => { document.removeEventListener("click", onClick, true); window.removeEventListener("beforeunload", onBefore); };
  }, [holdAtStake]);

  function leaveAndRelease() {
    const to = leaveTo || backHref;
    setLeaveTo(null);
    releaseHoldKeepCartAction(data.checkoutId); // free capacity, keep the cart
    router.push(to);
  }

  function confirm(paymentMethodId?: string) {
    setError(null);
    start(async () => {
      const res = await confirmAction(data.checkoutId, paymentMethodId);
      if (res.ok) { const { ok, ...c } = res; setDone(c); return; }
      if (res.code === "HOLD_EXPIRED") { setError("Your hold expired — head back and reserve again."); return; }
      if (res.code === "PAYMENT_FAILED") { setError("Payment didn’t go through. Your hold is still live — try another card."); return; }
      setError(res.error ?? "Could not complete checkout.");
    });
  }
  // Back to the exact listing they came from (the cart stays put, so they can
  // edit and return); falls back to browsing if we don't know the origin.
  const backHref = data.returnTo || routes.browse;

  // ── CONFIRMED ──
  if (done) {
    return (
      <section className="sec cosec">
        <div className="wrap co-confirm">
          <div className="co-check"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M20 6L9 17l-5-5" /></svg></div>
          <h1>You&apos;re booked</h1>
          <p className="co-sub">Reference <b>{done.reference}</b>{done.total ? <> · {money(done.total, done.currency)} paid</> : null}</p>
          <div className="co-grid">
            <div className="co-card">
              <h3>What you booked</h3>
              {(done.lines.length ? done.lines : data.lines).map((l, i) => <ItemRow key={i} l={l} cur={done.currency || cur} />)}
              {done.total ? <div className="co-total"><span>Total paid</span><b>{money(done.total, done.currency)}</b></div> : null}
            </div>
            <div className="co-card co-codes">
              <h3>From your host</h3>
              {done.instructions ? (
                <p className="co-instr">{done.instructions}</p>
              ) : (
                <p className="co-codehint">Your host’s drop-off &amp; collect details are on your booking page — we’ll walk you through it there.</p>
              )}
            </div>
          </div>
          <div className="co-card co-steps">
            <h3>What happens next</h3>
            <ol>
              <li><b>Check in.</b> Drop off at the space following your host’s instructions — they confirm and store your things.</li>
              <li><b>It&apos;s held &amp; protected.</b> Stowbo-protected up to $5,000 while it&apos;s in their care — take things out and put them back anytime during your booking.</li>
              <li><b>Check out.</b> Come back in your window to collect, and end your booking when you&apos;re done.</li>
            </ol>
          </div>
          <div className="co-cta">
            <Link className="btn clay lg" href={routes.account + "/bookings"}>View my bookings</Link>
            <Link className="btn ghost lg" href={routes.browse}>Browse more spaces</Link>
          </div>
        </div>
      </section>
    );
  }

  // ── CHECKOUT ──
  return (
    <section className="sec cosec">
      {leaveTo && (
        <div className="co-leave" role="dialog" aria-modal="true" onClick={() => setLeaveTo(null)}>
          <div className="co-leave-card" onClick={(e) => e.stopPropagation()}>
            <h3>Leave checkout?</h3>
            <p>Your hold on {data.lines.length > 1 ? "these spaces" : "this space"} will be released and the capacity handed back to others. Your cart is saved — you can pick it back up and hold again anytime.</p>
            <div className="co-leave-cta">
              <button type="button" className="btn clay" onClick={() => setLeaveTo(null)}>Keep my hold — stay</button>
              <button type="button" className="btn ghost" onClick={leaveAndRelease}>Release hold &amp; leave</button>
            </div>
          </div>
        </div>
      )}
      <div className="wrap co-checkout">
        <Link className="co-back" href={backHref}>← Back to listing</Link>
        <div className="co-head">
          <div><span className="co-eyebrow">Checkout</span><h1>Confirm your booking</h1></div>
          {data.holdExpiresAt && <span className={`co-timer${left <= 60 ? " low" : ""}`}>{left > 0 ? `Held ${mm}:${ss}` : "Hold expired"}</span>}
        </div>
        <div className="co-grid">
          <div className="co-card co-order">
            <h3>Your cart{data.lines.length > 1 ? ` · ${data.lines.length} spaces` : ""}</h3>
            {data.lines.map((l, i) => <ItemRow key={i} l={l} cur={cur} />)}
            {/* Fees are rows the server priced into this total — show every one, then tax. */}
            {(() => {
              const q = data.quote;
              const feeRows = q?.fees?.length ? q.fees : (q?.lines ?? []).flatMap((l) => l.fees ?? []);
              const taxRows = q?.taxLines?.length ? q.taxLines.map((t) => ({ label: t.jurisdiction ? `Tax · ${t.jurisdiction}` : "Tax", amount: t.amount })) : (q?.tax ? [{ label: "Tax", amount: q.tax }] : []);
              const discounts = (q?.discounts ?? []).map((d) => ({ label: d.name || d.label || "Discount", amount: -Math.abs(d.amount) }));
              const rows = [...discounts, ...feeRows, ...taxRows].filter((r) => r.amount);
              if (!rows.length) return null;
              return (
                <div className="co-fees">
                  {q?.subtotal != null && <div className="co-fee"><span>Spaces &amp; add-ons</span><span>{money(q.subtotal, cur)}</span></div>}
                  {rows.map((r, i) => <div className="co-fee" key={i}><span>{r.label}</span><span>{r.amount < 0 ? "−" : ""}{money(Math.abs(r.amount), cur)}</span></div>)}
                </div>
              );
            })()}
            {total ? <div className="co-total"><span>Total</span><b>{money(total, cur)}</b></div> : null}
            {rejected && <p className="bp-error" style={{ marginTop: 8 }}>{rejected.message || "That code didn’t apply."}{rejected.code ? ` (${rejected.code})` : ""}</p>}
            {applied ? (
              <p className="co-code-note">Code <b>{applied.code}</b> applied. <button type="button" className="co-code-rm" disabled={pending} onClick={() => applyCode("")}>Remove</button></p>
            ) : codeOpen || rejected ? (
              <form className="co-code" onSubmit={(e) => { e.preventDefault(); if (code.trim()) applyCode(code); }}>
                <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Promo code" aria-label="Promo code" autoFocus spellCheck={false} />
                <button type="submit" className="btn ghost sm" disabled={pending || !code.trim()}>{pending ? "…" : "Apply"}</button>
              </form>
            ) : (
              <button type="button" className="bp-code-link" onClick={() => setCodeOpen(true)}>Have a promo code?</button>
            )}
            {data.quote && <GoodToKnow fees={goodToKnow(data.quote)} currency={cur} />}
            <Link className="co-addmore" style={{ display: "block", marginTop: 12 }} href={routes.browse}>+ Add another space</Link>
          </div>
          <div className="co-card co-pay">
            <h3>Payment</h3>
            <div className="co-due">
              <div className="co-due-row"><span>Due now</span><b>{money(payNow, cur)}</b></div>
              {deposit > 0 && <p className="co-due-note">Includes {money(deposit, cur)} refundable deposit — returned when you check out.</p>}
              {laterDue > 0 && <p className="co-due-note">{money(laterDue, cur)} balance due at checkout.</p>}
            </div>
            {error && <div className="bp-error">{error}</div>}
            {expired ? (
              <Link className="btn clay lg" href={routes.browse} style={{ width: "100%", justifyContent: "center" }}>Hold expired — start again</Link>
            ) : payNow > 0 ? (
              <PaymentStep label={`Pay ${money(payNow, cur)} & confirm`} onPay={(pm) => confirm(pm)} busy={pending} />
            ) : (
              <button type="button" className="btn clay lg" style={{ width: "100%", justifyContent: "center", marginTop: 10 }} onClick={() => confirm()} disabled={pending}>
                {pending ? "Confirming…" : "Confirm booking"}
              </button>
            )}
            <p className="co-secure">🔒 We&apos;re holding your {data.lines.length > 1 ? "spaces" : "space"} while you confirm. Finish within the timer or it&apos;s released.</p>
            <Link className="co-release" href={backHref}>← Back to listing</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
