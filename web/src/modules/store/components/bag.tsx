"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCartAction, setQtyAction } from "../actions/cart";
import type { Cart } from "../lib/types";
import { money2 } from "../lib/money";
import { optionsText, instructionsOf } from "../lib/options";
import { Icon } from "./icons";
import { ShopBag } from "./shop-bag";

type Kind = "bag" | "food";

/** Fired after anything changes a cart; `detail.open` also opens the drawer. */
export function cartChanged(kind: Kind, open = false, cart?: Cart | null) {
  window.dispatchEvent(new CustomEvent("sf-cart-changed", { detail: { kind, open, cart } }));
}

/**
 * The header bag (shop) / basket (food): count badge, and a right-hand drawer with the
 * lines, quantity steppers and the engine's subtotal. Checkout is one tap away; looking
 * at the bag is not checking out.
 */
export function BagButton({ kind, label }: { kind: Kind; label?: string }) {
  // The shop's bag is base-app's cart (ported storefront); the food basket is still this one.
  if (kind === "bag") return <ShopBag label={label || "Bag"} />;
  return <FoodBagButton kind={kind} label={label} />;
}

function FoodBagButton({ kind, label }: { kind: Kind; label?: string }) {
  const path = usePathname() || "/";
  const [cart, setCart] = useState<Cart | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(() => { getCartAction(kind).then(setCart).catch(() => null); }, [kind]);
  useEffect(() => {
    refresh();
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      if (d.kind !== kind) return;
      if (d.cart !== undefined) setCart(d.cart); else refresh();
      if (d.open) setOpen(true);
    };
    window.addEventListener("sf-cart-changed", on);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("sf-cart-changed", on); window.removeEventListener("focus", refresh); };
  }, [kind, refresh, path]);
  useEffect(() => { setOpen(false); }, [path]);

  const count = cart?.totals.count ?? 0;
  const word = label || (kind === "food" ? "Basket" : "Bag");
  return (
    <>
      <button type="button" className="sf-bagbtn" aria-label={`${word}${count ? `, ${count} item${count === 1 ? "" : "s"}` : ""}`} onClick={() => { refresh(); setOpen(true); }}>
        <Icon name="bag" size={21} />
        {count > 0 && <span className="sf-bagbtn-n">{count}</span>}
      </button>
      {open && <BagDrawer kind={kind} cart={cart} onCart={setCart} onClose={() => setOpen(false)} word={word} />}
    </>
  );
}

function BagDrawer({ kind, cart, onCart, onClose, word }: { kind: Kind; cart: Cart | null; onCart: (c: Cart) => void; onClose: () => void; word: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [onClose]);

  const lines = cart?.lines || [];
  const setQty = (i: number, q: number) => start(async () => {
    setErr(null);
    const r = await setQtyAction(kind, i, q);
    if (r.ok) { onCart(r.cart); cartChanged(kind, false, r.cart); } else setErr(r.error);
  });
  const checkout = kind === "food" ? "/eat/checkout" : "/shop/checkout";

  return (
    <div className="sf-drawer-wrap" role="dialog" aria-modal="true" aria-label={word}>
      <button className="sf-drawer-scrim" aria-label="Close" onClick={onClose} />
      <aside className="sf-drawer">
        <header className="sf-drawer-hd">
          <h2>{word}{lines.length ? <span> · {cart?.totals.count}</span> : null}</h2>
          <button className="sf-iconbtn" aria-label="Close" onClick={onClose}><Icon name="x" size={20} /></button>
        </header>
        {!lines.length ? (
          <div className="sf-drawer-empty">
            <Icon name="bag" size={34} />
            <p>Your {word.toLowerCase()} is empty.</p>
            <Link className="sf-btn" href={kind === "food" ? "/eat" : "/shop"} onClick={onClose}>{kind === "food" ? "Find food" : "Shop best sellers"}</Link>
          </div>
        ) : (
          <>
            <ul className={`sf-drawer-lines${pending ? " busy" : ""}`}>
              {lines.map((l, i) => (
                <li key={`${l.sku}-${i}`} className="sf-line">
                  {l.image ? <img src={l.image} alt="" /> : <span className="sf-line-ph" />}
                  <div className="sf-line-main">
                    <b>{l.name}</b>
                    {optionsText(l.options) && <small>{optionsText(l.options)}</small>}
                    {instructionsOf(l.options) && <small className="sf-line-note">“{instructionsOf(l.options)}”</small>}
                    <div className="sf-qty sm">
                      <button aria-label="Fewer" onClick={() => setQty(i, l.quantity - 1)} disabled={pending}>{l.quantity === 1 ? <Icon name="x" size={13} /> : <Icon name="minus" size={14} />}</button>
                      <span>{l.quantity}</span>
                      <button aria-label="More" onClick={() => setQty(i, l.quantity + 1)} disabled={pending}><Icon name="plus" size={14} /></button>
                    </div>
                  </div>
                  <span className="sf-line-amt">{money2(l.lineTotal ?? 0, cart?.totals.currency)}</span>
                </li>
              ))}
            </ul>
            <footer className="sf-drawer-ft">
              {err && <p className="sf-err">{err}</p>}
              <div className="sf-drawer-sum"><span>Subtotal</span><b>{money2(cart?.totals.subtotal, cart?.totals.currency)}</b></div>
              <p className="sf-fine">{kind === "food" ? "Delivery fee and taxes at checkout." : "Shipping and taxes at checkout."}</p>
              <Link className="sf-btn block lg" href={checkout} onClick={onClose}>{kind === "food" ? "Go to checkout" : "Check out"}</Link>
              {kind === "bag" && <Link className="sf-link center" href="/shop/cart" onClick={onClose}>View bag</Link>}
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
