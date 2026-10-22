"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { routes } from "@/lib/nav";
import { fmtFull, duration } from "@/lib/dates";
import { cartViewAction, removeCartLineAction, applyCartCodeAction, type CartView, type CartViewLine } from "@/modules/rentals/actions/checkout";

const money = (n: number, cur = "USD") => {
  const hasCents = Math.round(n * 100) % 100 !== 0;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: cur, minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 }).format(n);
};

/** The cart, as a right-side drawer. Viewing the cart is NOT checking out — this
 *  reads the server cart and takes no hold, so someone can peek at what they've
 *  added, drop a line, and keep browsing. The hold is only taken when they press
 *  "Check out" and land on /checkout. */
export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [view, setView] = useState<CartView | null | "loading">("loading");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeOpen, setCodeOpen] = useState(false);

  // The button mounts this drawer fresh on every open, so the initial "loading" state
  // is the reset — the effect only fetches.
  useEffect(() => {
    if (!open) return;
    let live = true;
    cartViewAction().then((v) => { if (live) setView(v); });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { live = false; document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  function remove(l: CartViewLine) {
    setError(null);
    start(async () => {
      const res = await removeCartLineAction(l);
      if (!res.ok) { setError(res.error ?? "Could not update your cart."); return; }
      try { window.dispatchEvent(new Event("stowbo-cart-changed")); } catch { /* ssr */ }
      setView(await cartViewAction());
    });
  }

  function applyCode(next: string) {
    setError(null);
    start(async () => {
      const res = await applyCartCodeAction(next);
      if (!res.ok) { setError(res.error ?? "Could not apply that code."); return; }
      try { window.dispatchEvent(new Event("stowbo-cart-changed")); } catch { /* ssr */ }
      setView(res.view); if (!next) { setCode(""); setCodeOpen(false); }
    });
  }

  const lines = view && view !== "loading" ? view.lines : [];
  const cur = view && view !== "loading" ? view.currency : "USD";

  return (
    <div className="drw-ov" role="dialog" aria-modal="true" aria-label="Your cart" onClick={onClose}>
      <aside className="drw-panel cart-drw" style={{ width: "min(440px, 100%)" }} onClick={(e) => e.stopPropagation()}>
        <div className="drw-hd">
          <div>
            <h2 className="drw-title">Your cart</h2>
            {lines.length > 0 && <p className="drw-sub">{lines.length} {lines.length === 1 ? "space" : "spaces"} · nothing is held until you check out</p>}
          </div>
          <button type="button" className="drw-x" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="drw-body">
          {view === "loading" ? (
            <p className="muted">Loading your cart…</p>
          ) : !view ? (
            <div className="cart-empty">
              <p className="muted">Your cart is empty.</p>
              <Link className="btn clay" href={routes.browse} onClick={onClose}>Browse spaces</Link>
            </div>
          ) : (
            <>
              {view.held && <div className="cart-held-note">You have a checkout in progress — your hold is still live.</div>}
              <div className="cart-lines">
                {view.lines.map((l, i) => {
                  const dur = duration(l.startDate, l.endDate);
                  return (
                    <div className="cart-line" key={`${l.listing}|${l.startDate}|${l.endDate}|${i}`}>
                      <div className="cart-line-top">
                        <Link className="cart-line-title" href={`/listing/${l.listing}`} onClick={onClose}>{l.title}{l.quantity && l.quantity > 1 ? ` ×${l.quantity}` : ""}</Link>
                        {l.amount ? <b className="cart-line-amt">{money(l.amount, cur)}</b> : null}
                      </div>
                      <div className="cart-line-dates">
                        <span>{fmtFull(l.startDate)}</span><span aria-hidden>→</span><span>{fmtFull(l.endDate)}</span>
                        {dur ? <span className="cart-line-dur">{dur}</span> : null}
                      </div>
                      <button type="button" className="cart-line-rm" onClick={() => remove(l)} disabled={pending}>Remove</button>
                    </div>
                  );
                })}
              </div>
              {error && <div className="bp-error">{error}</div>}
              {(view.discounts?.length || view.fees?.length) ? (
                <div className="cart-breakdown">
                  {view.subtotal != null && <div className="cart-brow"><span>Spaces &amp; add-ons</span><span>{money(view.subtotal, cur)}</span></div>}
                  {(view.discounts ?? []).map((d, i) => <div className="cart-brow cart-disc" key={`d${i}`}><span>{d.label}{d.code ? ` · ${d.code}` : ""}</span><span>−{money(Math.abs(d.amount), cur)}</span></div>)}
                  {(view.fees ?? []).map((f, i) => <div className="cart-brow" key={`f${i}`}><span>{f.label}</span><span>{money(f.amount, cur)}</span></div>)}
                </div>
              ) : null}
              <div className="cart-total"><span>Total</span><b>{money(view.total, cur)}</b></div>
              {view.discountRejected && <p className="bp-error" style={{ marginTop: 6 }}>{view.discountRejected.message || "That code didn’t apply."}{view.discountRejected.code ? ` (${view.discountRejected.code})` : ""}</p>}
              {view.discounts?.length ? (
                <p className="cart-fine">Code <b>{view.discounts[0].code || view.discountCode}</b> applied. <button type="button" className="cart-line-rm" disabled={pending} onClick={() => applyCode("")}>Remove</button></p>
              ) : codeOpen || view.discountRejected ? (
                <form className="cart-code" onSubmit={(e) => { e.preventDefault(); if (code.trim()) applyCode(code); }}>
                  <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Promo code" aria-label="Promo code" autoFocus spellCheck={false} />
                  <button type="submit" className="btn ghost sm" disabled={pending || !code.trim()}>{pending ? "…" : "Apply"}</button>
                </form>
              ) : (
                <button type="button" className="bp-code-link" onClick={() => setCodeOpen(true)}>Have a promo code?</button>
              )}
              <p className="cart-fine">Final price and any deposit are confirmed at checkout.</p>
              <div className="cart-cta">
                <Link className="btn clay lg" href="/checkout" onClick={onClose}>{view.held ? "Continue checkout" : "Check out"}</Link>
                <button type="button" className="btn ghost lg" onClick={onClose}>Keep browsing</button>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
