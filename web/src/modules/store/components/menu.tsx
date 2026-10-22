"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Cart, Product } from "../lib/types";
import { money2 } from "../lib/money";
import { attrTitle, defaultSelection, isMulti, isText, optionDelta, optionsText, productImage, type Selection } from "../lib/options";
import { addToCartAction, getCartAction, priceAction, setQtyAction } from "../actions/cart";
import { cartChanged } from "./bag";
import { Icon } from "./icons";

export interface MenuSection { id: string; title: string; items: Product[] }

/**
 * A restaurant's menu: a sticky section rail, "Popular" as big photo tiles, then each
 * section's item cards (text left, photo right, round + button). Tapping an item opens
 * its sheet; the basket sits on the right (desktop) or as a bar at the bottom (phone).
 */
export function RestaurantMenu({ restaurant, restaurantTitle, sections, popular, initialCart }: { restaurant: string; restaurantTitle: string; sections: MenuSection[]; popular: Product[]; initialCart: Cart | null }) {
  const [open, setOpen] = useState<Product | null>(null);
  const [cart, setCart] = useState<Cart | null>(initialCart);
  const [active, setActive] = useState(sections[0]?.id || "");
  const mine = cart && cart.restaurant === restaurant && cart.lines.length ? cart : null;

  useEffect(() => {
    const on = (e: Event) => { const d = (e as CustomEvent).detail || {}; if (d.kind === "food") { if (d.cart !== undefined) setCart(d.cart); else getCartAction("food").then(setCart); } };
    window.addEventListener("sf-cart-changed", on);
    return () => window.removeEventListener("sf-cart-changed", on);
  }, []);

  // Rail follows the scroll.
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(`sec-${s.id}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((ents) => {
      const vis = ents.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActive(vis.target.id.replace(/^sec-/, ""));
    }, { rootMargin: "-120px 0px -60% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  return (
    <div className="ea-menu">
      <nav className="ea-rail" aria-label="Menu">
        {popular.length > 0 && <a href="#sec-popular" className={active === "popular" ? "on" : ""}>Popular</a>}
        {sections.map((s) => <a key={s.id} href={`#sec-${s.id}`} className={active === s.id ? "on" : ""}>{s.title}</a>)}
      </nav>

      <div className="ea-items">
        {popular.length > 0 && (
          <section id="sec-popular" className="ea-sec">
            <h2>Popular</h2>
            <p className="ea-sec-sub">The most ordered right now</p>
            <div className="ea-feat">
              {popular.map((p) => (
                <button key={p.sk} className="ea-feat-card" onClick={() => setOpen(p)}>
                  <span className="ea-feat-img">{productImage(p) && <img src={productImage(p)} alt="" loading="lazy" />}<i className="ea-plus"><Icon name="plus" size={18} /></i></span>
                  <b>{p.data.name}</b>
                  <span>{money2(p.data.calculatedPrice?.finalPrice ?? p.data.price)}</span>
                </button>
              ))}
            </div>
          </section>
        )}
        {sections.map((s) => (
          <section key={s.id} id={`sec-${s.id}`} className="ea-sec">
            <h2>{s.title}</h2>
            <div className="ea-list">
              {s.items.map((p) => (
                <button key={p.sk} className="ea-item" onClick={() => setOpen(p)}>
                  <span className="ea-item-txt">
                    <b>{p.data.name}</b>
                    <span className="ea-item-price">{money2(p.data.calculatedPrice?.finalPrice ?? p.data.price)}{p.data.popular && <em>· Popular</em>}</span>
                    {p.data.description && <small>{p.data.description}</small>}
                  </span>
                  <span className="ea-item-img">{productImage(p) && <img src={productImage(p)} alt="" loading="lazy" />}<i className="ea-plus"><Icon name="plus" size={16} /></i></span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <BasketPanel cart={mine} title={restaurantTitle} onCart={setCart} />
      {open && <ItemSheet p={open} onClose={() => setOpen(null)} onAdded={(c) => { setCart(c); setOpen(null); }} />}
    </div>
  );
}

/** Desktop: the order on the right. Phone: a "View basket" bar pinned to the bottom. */
function BasketPanel({ cart, title, onCart }: { cart: Cart | null; title: string; onCart: (c: Cart) => void }) {
  const [pending, start] = useTransition();
  const [sheet, setSheet] = useState(false);
  const setQty = (i: number, q: number) => start(async () => { const r = await setQtyAction("food", i, q); if (r.ok) { onCart(r.cart); cartChanged("food", false, r.cart); } });
  const body = cart ? (
    <>
      <ul className={`ea-bk-lines${pending ? " busy" : ""}`}>
        {cart.lines.map((l, i) => (
          <li key={`${l.sku}-${i}`}>
            <select aria-label="Quantity" value={l.quantity} onChange={(e) => setQty(i, Number(e.target.value))} disabled={pending}>
              <option value={0}>Remove</option>
              {Array.from({ length: Math.max(10, l.quantity) }, (_, k) => k + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="ea-bk-ln"><b>{l.name}</b>{optionsText(l.options) && <small>{optionsText(l.options)}</small>}</span>
            <span>{money2(l.lineTotal ?? 0)}</span>
          </li>
        ))}
      </ul>
      <div className="ea-bk-sum"><span>Subtotal</span><b>{money2(cart.totals.subtotal)}</b></div>
      <Link className="ea-btn block" href="/eat/checkout">Go to checkout · {money2(cart.totals.subtotal)}</Link>
    </>
  ) : (
    <div className="ea-bk-empty"><Icon name="bag" size={28} /><p>Your basket is empty</p><small>Add something from the menu to start an order.</small></div>
  );
  return (
    <>
      <aside className="ea-basket" aria-label="Your order">
        <h3>{cart ? <>Your order <span>· {title}</span></> : "Your order"}</h3>
        {body}
      </aside>
      {cart && (
        <button className="ea-bk-bar" onClick={() => setSheet(true)}>
          <span className="ea-bk-n">{cart.totals.count}</span>View basket<b>{money2(cart.totals.subtotal)}</b>
        </button>
      )}
      {sheet && cart && (
        <div className="sf-drawer-wrap" role="dialog" aria-modal="true" aria-label="Basket">
          <button className="sf-drawer-scrim" aria-label="Close" onClick={() => setSheet(false)} />
          <aside className="sf-drawer ea-bk-drawer">
            <header className="sf-drawer-hd"><h2>{title}</h2><button className="sf-iconbtn" aria-label="Close" onClick={() => setSheet(false)}><Icon name="x" size={20} /></button></header>
            <div className="ea-bk-drawer-body">{body}</div>
          </aside>
        </div>
      )}
    </>
  );
}

/** The item sheet: photo, required/optional groups with their surcharges, special
 *  instructions, quantity, and "Add N to order · $X" — X is the engine's price for
 *  exactly this selection. */
function ItemSheet({ p, onClose, onAdded }: { p: Product; onClose: () => void; onAdded: (c: Cart) => void }) {
  const d = p.data;
  const [sel, setSel] = useState<Selection>(() => defaultSelection(p));
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState<number | null>(Number(d.calculatedPrice?.finalPrice ?? d.price));
  const [pricing, setPricing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ current: string; next: string } | null>(null);
  const [pending, start] = useTransition();
  const seq = useRef(0);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [onClose]);
  useEffect(() => {
    const n = ++seq.current;
    setPricing(true);
    const t = setTimeout(() => priceAction(d.sku, qty, sel).then((r) => { if (n !== seq.current) return; setPricing(false); if (r.ok) setPrice(r.total); }), 100);
    return () => clearTimeout(t);
  }, [d.sku, qty, sel]);

  const add = (fresh = false) => start(async () => {
    setErr(null);
    const r = await addToCartAction("food", { sku: d.sku, quantity: qty, selection: sel }, fresh);
    if (r.ok) { cartChanged("food", false, r.cart); onAdded(r.cart); return; }
    if ("conflict" in r) { setConflict(r.conflict); return; }
    setErr(r.error);
  });

  const groups = d.attributes || [];
  return (
    <div className="ea-sheet-wrap" role="dialog" aria-modal="true" aria-label={d.name}>
      <button className="sf-drawer-scrim" aria-label="Close" onClick={onClose} />
      <div className="ea-sheet">
        <button className="ea-sheet-x" aria-label="Close" onClick={onClose}><Icon name="x" size={20} /></button>
        <div className="ea-sheet-scroll">
          {productImage(p) && <img className="ea-sheet-img" src={productImage(p)} alt="" />}
          <div className="ea-sheet-hd">
            <h2>{d.name}</h2>
            <p className="ea-sheet-price">{money2(d.calculatedPrice?.finalPrice ?? d.price)}</p>
            {d.description && <p className="ea-sheet-desc">{d.description}</p>}
          </div>
          {groups.map((a) => {
            if (isText(a)) {
              return (
                <div key={a.name} className="ea-grp">
                  <div className="ea-grp-hd"><b>{attrTitle(a)}</b><span className="ea-tag">Optional</span></div>
                  <textarea rows={2} maxLength={300} placeholder="Allergies, no onions, extra napkins…" value={String(sel[a.name] || "")} onChange={(e) => setSel((s) => ({ ...s, [a.name]: e.target.value }))} />
                </div>
              );
            }
            const multi = isMulti(a);
            const v = sel[a.name];
            const picked = Array.isArray(v) ? v : [];
            const req = !multi && a.required !== false;
            return (
              <div key={a.name} className="ea-grp">
                <div className="ea-grp-hd">
                  <b>{attrTitle(a)}</b>
                  <span className={`ea-tag${req ? " req" : ""}`}>{req ? "Required" : multi && a.maxValue ? `Optional · Choose up to ${a.maxValue}` : "Optional"}</span>
                </div>
                {a.options?.map((o) => {
                  const on = multi ? picked.includes(o.value) : v === o.value;
                  const full = multi && !on && !!a.maxValue && picked.length >= a.maxValue;
                  const delta = optionDelta(o);
                  return (
                    <label key={o.value} className={`ea-opt${full ? " off" : ""}`}>
                      <input type={multi ? "checkbox" : "radio"} name={`${d.sku}-${a.name}`} checked={on} disabled={full}
                        onChange={() => setSel((s) => multi ? { ...s, [a.name]: on ? picked.filter((x) => x !== o.value) : [...picked, o.value] } : { ...s, [a.name]: o.value })} />
                      <span>{o.label}</span>
                      {delta ? <em>{delta > 0 ? "+" : "−"}{money2(Math.abs(delta))}</em> : null}
                    </label>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="ea-sheet-ft">
          {conflict ? (
            <div className="ea-conflict">
              <b>Start a new order?</b>
              <p>Your basket has items from {conflict.current}. Start a new basket to add items from {conflict.next}.</p>
              <div><button className="ea-btn ghost" onClick={() => setConflict(null)}>Keep basket</button><button className="ea-btn" onClick={() => add(true)} disabled={pending}>New order</button></div>
            </div>
          ) : (
            <>
              {err && <p className="sf-err">{err}</p>}
              <div className="ea-sheet-row">
                <div className="sf-qty" aria-label="Quantity">
                  <button type="button" aria-label="Fewer" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}><Icon name="minus" size={15} /></button>
                  <span>{qty}</span>
                  <button type="button" aria-label="More" onClick={() => setQty((q) => Math.min(20, q + 1))}><Icon name="plus" size={15} /></button>
                </div>
                <button className="ea-btn grow" onClick={() => add()} disabled={pending || pricing}>
                  {pending ? "Adding…" : `Add ${qty} to order · ${price != null ? money2(price) : ""}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

