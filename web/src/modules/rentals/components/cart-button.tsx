"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cartCountAction } from "@/modules/rentals/actions/checkout";
import { CartDrawer } from "./cart-drawer";

/** Persistent cart affordance — whenever there's an open cart (with or without a
 *  live hold), a purchase-in-progress is always one click from the header. It
 *  refreshes on navigation and on the `stowbo-cart-changed` event the booking
 *  panel fires after an add, so the count is never stale.
 *
 *  Clicking it opens the cart DRAWER (view / remove / keep browsing). It does NOT
 *  go to /checkout — that page takes a hold on the capacity, and looking at your
 *  cart is not an intent to buy. `stowbo-cart-open` opens the drawer from anywhere. */
export function CartButton() {
  const path = usePathname() || "/";
  const [state, setState] = useState<{ count: number; held: boolean }>({ count: 0, held: false });
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    let live = true;
    const refresh = () => cartCountAction().then((s) => { if (live) setState(s); });
    refresh();
    const onChange = () => refresh();
    const onOpen = () => { refresh(); setOpen(true); };
    window.addEventListener("stowbo-cart-changed", onChange);
    window.addEventListener("stowbo-cart-open", onOpen);
    window.addEventListener("focus", onChange);
    return () => {
      live = false;
      window.removeEventListener("stowbo-cart-changed", onChange);
      window.removeEventListener("stowbo-cart-open", onOpen);
      window.removeEventListener("focus", onChange);
    };
  }, [path]);

  useEffect(() => { setOpen(false); }, [path]); // navigating closes the drawer

  if (path.startsWith("/checkout")) return null;
  if (state.count <= 0 && !open) return null;

  return (
    <>
      <button type="button" className={`cart-btn${state.held ? " held" : ""}`} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-label={`Cart, ${state.count} item${state.count === 1 ? "" : "s"}${state.held ? ", checkout in progress" : ""}`}>
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" />
          <path d="M2.5 3h2l2.2 12.3a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.2L21.5 7H6" />
        </svg>
        <span className="cart-lbl">Cart</span>
        <span className="cart-count">{state.count}</span>
      </button>
      {open && <CartDrawer open onClose={close} />}
    </>
  );
}
